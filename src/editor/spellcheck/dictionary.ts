/**
 * @fileoverview Async dictionary loader for the in-editor spellchecker.
 *
 * - For `en`: fetches the bundled Hunspell `.aff` and `.dic` files from the
 *   static `public/dictionary/` directory, caches them in IndexedDB (Dexie)
 *   so subsequent loads are offline-friendly.
 * - For any other language: returns `null` (unsupported). Future language
 *   packs should follow the same `public/dictionary/${lang}.{aff,dic}` +
 *   Dexie cache pattern.
 * - Parsing and word checks run in a Web Worker (`spellWorker.ts`); nspell's
 *   synchronous parse of the size-70 SCOWL list is too heavy for the main
 *   thread on slower machines.
 *
 * Exposes `loadSpellchecker(language)` and `prefetchSpellchecker(language)`.
 *
 * @module editor/spellcheck/dictionary
 */

import type { SpellDictionaryCacheEntry } from '../../db/characterTypes';
import { characterDb } from '../../db/CharacterDatabase';
import type { SpellWorkerRequest, SpellWorkerResponse } from './spellWorker';

const LOAD_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Bump when the files in `public/dictionary/` change so cached copies (keyed
 * by `${language}:${revision}`) and the HTTP cache are bypassed.
 */
const DICTIONARY_REVISION = 'scowl70-2026.06';

/** Bundled, supported languages. Add entries here as new dictionaries are added. */
const SUPPORTED_LANGUAGES: ReadonlySet<string> = new Set(['en']);

export interface LoadedSpellchecker {
  /** The language code (e.g. "en") */
  language: string;
  /** True if this instance was loaded from the IndexedDB cache (vs. fresh). */
  fromCache: boolean;
  /**
   * Last known result per word, filled by `check`. Lets the editor re-spell
   * synchronously when every visible word has already been checked.
   */
  known: ReadonlyMap<string, boolean>;
  /** Check words (hyphen-segment aware, see `isWordCorrect`). Results align with `words`. */
  check(words: readonly string[]): Promise<boolean[]>;
  suggest(word: string): Promise<string[]>;
  /** Add words to the session dictionary; clears `known` so they re-check. */
  add(words: readonly string[]): void;
}

export class UnsupportedSpellLanguageError extends Error {
  constructor(language: string) {
    super(`Unsupported spellcheck language: "${language}"`);
    this.name = 'UnsupportedSpellLanguageError';
  }
}

/** In-flight loaders, keyed by language, so concurrent callers share the same promise. */
const inflight = new Map<string, Promise<LoadedSpellchecker | null>>();

/**
 * Load a spellchecker for `language`. Returns `null` for unsupported languages.
 *
 * Concurrent calls for the same language share a single loader.
 */
export function loadSpellchecker(language: string): Promise<LoadedSpellchecker | null> {
  const key = (language || 'en').toLowerCase();
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    if (!SUPPORTED_LANGUAGES.has(key)) {
      if (import.meta.env.DEV) {
        console.warn(`[spellcheck] unsupported language "${key}"`);
      }
      return null;
    }

    const cacheId = `${key}:${DICTIONARY_REVISION}`;
    const cached = await readCache(cacheId);
    if (cached) {
      try {
        return await buildSpellchecker(key, cached.aff, cached.dic, true);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[spellcheck] cached dictionary failed to load, refetching', error);
        }
        await safeDeleteCache(cacheId);
      }
    }

    try {
      const aff = await fetchWithTimeout(dictionaryUrl(key, 'aff'), LOAD_TIMEOUT_MS);
      const dic = await fetchWithTimeout(dictionaryUrl(key, 'dic'), LOAD_TIMEOUT_MS);
      void writeCache({ id: cacheId, aff, dic, cachedAt: Date.now() }).then(() => safeDeleteCache(key));
      return await buildSpellchecker(key, aff, dic, false);
    } catch (error) {
      console.error(`[spellcheck] failed to load dictionary "${key}"`, error);
      return null;
    }
  })();

  inflight.set(key, promise);
  return promise.finally(() => {
    inflight.delete(key);
  });
}

/**
 * Pre-fetch and cache a dictionary so it's available on first use.
 * Safe to call multiple times.
 */
export async function prefetchSpellchecker(language: string): Promise<void> {
  await loadSpellchecker(language);
}

function dictionaryUrl(language: string, ext: 'aff' | 'dic'): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${base}/dictionary/${language}.${ext}?v=${DICTIONARY_REVISION}`;
}

function buildSpellchecker(
  language: string,
  aff: string,
  dic: string,
  fromCache: boolean,
): Promise<LoadedSpellchecker> {
  const worker = new Worker(new URL('./spellWorker.ts', import.meta.url), { type: 'module' });
  const pending = new Map<number, (response: SpellWorkerResponse) => void>();
  const known = new Map<string, boolean>();
  let nextId = 0;
  let failure: SpellWorkerResponse | null = null;

  const request = (message: SpellWorkerRequest & { id: number }): Promise<SpellWorkerResponse> =>
    new Promise((resolve) => {
      if (failure) return resolve(failure);
      pending.set(message.id, resolve);
      worker.postMessage(message);
    });

  worker.onmessage = (event: MessageEvent<SpellWorkerResponse>) => {
    const resolve = pending.get(event.data.id);
    if (!resolve) return;
    pending.delete(event.data.id);
    resolve(event.data);
  };

  const loaded: LoadedSpellchecker = {
    language,
    fromCache,
    known,
    async check(words) {
      const response = await request({ type: 'check', id: nextId++, words: [...words] });
      const correct = response.type === 'checked' ? response.correct : words.map(() => true);
      words.forEach((word, i) => known.set(word, correct[i]));
      return correct;
    },
    async suggest(word) {
      const response = await request({ type: 'suggest', id: nextId++, word });
      return response.type === 'suggested' ? response.suggestions : [];
    },
    add(words) {
      if (words.length === 0) return;
      known.clear();
      worker.postMessage({ type: 'add', words: [...words] } satisfies SpellWorkerRequest);
    },
  };

  return new Promise((resolve, reject) => {
    worker.onerror = (event) => {
      const message = event.message || 'Spellcheck worker failed';
      failure = { type: 'loaded', id: -1, ok: false, error: message };
      worker.terminate();
      for (const settle of pending.values()) settle(failure);
      pending.clear();
      reject(new Error(message));
    };
    void request({ type: 'load', id: nextId++, aff, dic }).then((response) => {
      if (response.type === 'loaded' && response.ok) {
        resolve(loaded);
      } else {
        worker.terminate();
        reject(new Error((response.type === 'loaded' && response.error) || 'Spellcheck worker failed to load'));
      }
    });
  });
}

async function readCache(id: string): Promise<SpellDictionaryCacheEntry | undefined> {
  try {
    const entry = await characterDb.spellDictionaryCache.get(id);
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      await safeDeleteCache(id);
      return undefined;
    }
    return entry;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[spellcheck] failed to read dictionary cache', error);
    }
    return undefined;
  }
}

async function writeCache(entry: SpellDictionaryCacheEntry): Promise<void> {
  try {
    await characterDb.spellDictionaryCache.put(entry);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[spellcheck] failed to write dictionary cache', error);
    }
  }
}

async function safeDeleteCache(id: string): Promise<void> {
  try {
    await characterDb.spellDictionaryCache.delete(id);
  } catch {
    // ignore
  }
}

async function fetchWithTimeout(url: string, ms: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Fetch ${url} failed: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}
