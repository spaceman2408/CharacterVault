/**
 * @fileoverview Async dictionary loader for the in-editor spellchecker.
 *
 * - For `en`: fetches the bundled Hunspell `.aff` and `.dic` files from the
 *   static `public/dictionary/` directory, caches them in IndexedDB (Dexie)
 *   so subsequent loads are offline-friendly.
 * - For any other language: returns `null` (unsupported). Future language
 *   packs should follow the same `public/dictionary/${lang}.{aff,dic}` +
 *   Dexie cache pattern.
 *
 * Exposes `loadSpellchecker(language)` and `prefetchSpellchecker(language)`.
 *
 * @module editor/spellcheck/dictionary
 */

import * as nspellModule from 'nspell';
import type { SpellDictionaryCacheEntry } from '../../db/characterTypes';
import { characterDb } from '../../db/CharacterDatabase';

type NSpellFn = (aff: string, dic: string) => import('nspell').NSpell;
const nspell: NSpellFn =
  (nspellModule as unknown as { default?: NSpellFn }).default ?? (nspellModule as unknown as NSpellFn);

const LOAD_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Bundled, supported languages. Add entries here as new dictionaries are added. */
const SUPPORTED_LANGUAGES: ReadonlySet<string> = new Set(['en']);

export interface LoadedSpellchecker {
  /** The language code (e.g. "en") */
  language: string;
  /** The nspell instance. Safe to use for `.correct(word)` and `.suggest(word)`. */
  spell: import('nspell').NSpell;
  /** True if this instance was loaded from the IndexedDB cache (vs. fresh). */
  fromCache: boolean;
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

    const cached = await readCache(key);
    if (cached) {
      try {
        return buildSpellchecker(key, cached.aff, cached.dic, true);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[spellcheck] cached dictionary failed to load, refetching', error);
        }
        await safeDeleteCache(key);
      }
    }

    try {
      const aff = await fetchWithTimeout(dictionaryUrl(key, 'aff'), LOAD_TIMEOUT_MS);
      const dic = await fetchWithTimeout(dictionaryUrl(key, 'dic'), LOAD_TIMEOUT_MS);
      void writeCache({ id: key, aff, dic, cachedAt: Date.now() });
      return buildSpellchecker(key, aff, dic, false);
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
  return `${base}/dictionary/${language}.${ext}`;
}

function buildSpellchecker(
  language: string,
  aff: string,
  dic: string,
  fromCache: boolean,
): LoadedSpellchecker {
  return { language, spell: nspell(aff, dic), fromCache };
}

async function readCache(language: string): Promise<SpellDictionaryCacheEntry | undefined> {
  try {
    const entry = await characterDb.spellDictionaryCache.get(language);
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      await safeDeleteCache(language);
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

async function safeDeleteCache(language: string): Promise<void> {
  try {
    await characterDb.spellDictionaryCache.delete(language);
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
