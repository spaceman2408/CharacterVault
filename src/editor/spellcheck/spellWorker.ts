import * as nspellModule from 'nspell';
import { isWordCorrect } from './wordCheck';

type NSpell = import('nspell').NSpell;
type NSpellFn = (aff: string, dic: string) => NSpell;
const nspell: NSpellFn =
  (nspellModule as unknown as { default?: NSpellFn }).default ?? (nspellModule as unknown as NSpellFn);

export type SpellWorkerRequest =
  | { type: 'load'; id: number; aff: string; dic: string }
  | { type: 'check'; id: number; words: string[] }
  | { type: 'suggest'; id: number; word: string }
  | { type: 'add'; words: string[] };

export type SpellWorkerResponse =
  | { type: 'loaded'; id: number; ok: boolean; error?: string }
  | { type: 'checked'; id: number; correct: boolean[] }
  | { type: 'suggested'; id: number; suggestions: string[] };

const scope = self as unknown as {
  postMessage(message: SpellWorkerResponse): void;
  onmessage: ((event: MessageEvent<SpellWorkerRequest>) => void) | null;
};

let spell: NSpell | null = null;

scope.onmessage = (event) => {
  const request = event.data;
  switch (request.type) {
    case 'load':
      try {
        spell = nspell(request.aff, request.dic);
        scope.postMessage({ type: 'loaded', id: request.id, ok: true });
      } catch (error) {
        spell = null;
        scope.postMessage({ type: 'loaded', id: request.id, ok: false, error: String(error) });
      }
      return;
    case 'check': {
      const current = spell;
      const correct = request.words.map((word) => (current ? isWordCorrect(current, word) : true));
      scope.postMessage({ type: 'checked', id: request.id, correct });
      return;
    }
    case 'suggest': {
      let suggestions: string[] = [];
      try {
        suggestions = spell ? spell.suggest(request.word).slice(0, 8) : [];
      } catch {
        suggestions = [];
      }
      scope.postMessage({ type: 'suggested', id: request.id, suggestions });
      return;
    }
    case 'add':
      if (!spell) return;
      for (const word of request.words) {
        try {
          spell.add(word);
        } catch {
          // nspell occasionally throws on malformed words; safe to ignore
        }
      }
      return;
  }
};
