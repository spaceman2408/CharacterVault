import type { CharacterBook, LorebookEntry } from '../../../db/characterTypes';
import { contentMatchesKey } from '../../../components/editor/lorebook/recursionGraph';
import { SELECTIVE_LOGIC_OPTIONS } from '../../../components/editor/lorebook/constants';
import { estimateTokens } from '../../../services/AIService';
import { entryLabel } from './recursion';

const MAX_ACTIVE_LINES = 60;
const MAX_MISSED_LINES = 30;
const MAX_RECURSION_PASSES = 10;

interface Activation {
  entry: LorebookEntry;
  reason: string;
}

function matchOptions(entry: LorebookEntry) {
  return { caseSensitive: entry.case_sensitive, matchWholeWords: entry.matchWholeWords };
}

/** Each chunk is matched on its own, so a large book never builds one joined scan string. */
function firstMatchingKey(chunks: readonly string[], entry: LorebookEntry): string | null {
  const options = matchOptions(entry);
  for (const key of entry.keys ?? []) {
    if (chunks.some((chunk) => contentMatchesKey(chunk, key, options))) return key.trim();
  }
  return null;
}

function formatKeyList(keys: string[]): string {
  const shown = keys.slice(0, 4);
  const extra = keys.length - shown.length;
  return extra > 0 ? `${shown.join(', ')}, …+${extra}` : shown.join(', ');
}

/** SillyTavern only applies secondary keys when selective is on and the list is not empty. */
function secondaryKeyFailure(entry: LorebookEntry, chunks: readonly string[]): string | null {
  const secondary = (entry.secondary_keys ?? []).filter((key) => key.trim());
  if (!entry.selective || secondary.length === 0) return null;
  const options = matchOptions(entry);
  const hits = secondary.filter((key) => chunks.some((chunk) => contentMatchesKey(chunk, key, options))).length;
  const logic = entry.selectiveLogic ?? 0;
  const passed =
    logic === 0
      ? hits > 0
      : logic === 1
        ? hits < secondary.length
        : logic === 2
          ? hits === 0
          : hits === secondary.length;
  if (passed) return null;
  const label = SELECTIVE_LOGIC_OPTIONS.find((option) => option.value === logic)?.label ?? 'AND ANY';
  return `secondary keys failed (${label}: ${formatKeyList(secondary)})`;
}

function chanceNote(entry: LorebookEntry): string {
  if (entry.useProbability === false || entry.probability == null || entry.probability >= 100) return '';
  return `, ${entry.probability}% chance`;
}

/**
 * Each pass scans only the entries activated by the pass before it. `held` keeps entries whose
 * primary key already hit but were held back (secondary keys or delay), so later text can release them.
 */
function runRecursivePasses(
  entries: LorebookEntry[],
  text: string,
  active: Map<number, Activation>,
  missed: Map<number, string>,
  held: Map<number, string>,
): boolean {
  const scanned: string[] = [text];
  let fresh = [...active.values()].map((activation) => activation.entry);
  for (let pass = 0; pass < MAX_RECURSION_PASSES; pass += 1) {
    const sources = fresh.filter((entry) => !entry.preventRecursion && entry.content);
    if (sources.length === 0) return false;
    const sourceTexts = sources.map((entry) => entry.content);
    scanned.push(...sourceTexts);

    const added: Activation[] = [];
    for (const entry of entries) {
      if (active.has(entry.id) || entry.enabled === false || entry.constant || entry.excludeRecursion) continue;
      const newKey = firstMatchingKey(sourceTexts, entry);
      const key = newKey ?? held.get(entry.id);
      if (!key) continue;
      if (secondaryKeyFailure(entry, scanned)) {
        if (newKey) held.set(entry.id, newKey);
        continue;
      }
      const options = matchOptions(entry);
      const source = newKey
        ? sources.find((candidate) => contentMatchesKey(candidate.content, key, options))
        : undefined;
      added.push({
        entry,
        reason: `"${key}" ${source ? `from ${entryLabel(source)}` : 'on a recursive pass'}`,
      });
    }
    if (added.length === 0) return false;
    for (const activation of added) {
      active.set(activation.entry.id, activation);
      missed.delete(activation.entry.id);
      held.delete(activation.entry.id);
    }
    fresh = added.map((activation) => activation.entry);
  }
  return true;
}

/**
 * Which entries a sample chat text would activate. Approximates SillyTavern's scan:
 * constants, primary and secondary keys, and recursion when recursive_scanning is on.
 */
export function formatKeyTest(book: CharacterBook, text: string): string {
  const entries = book.entries ?? [];
  if (entries.length === 0) return 'Key test — the book has no entries.';

  const active = new Map<number, Activation>();
  const missed = new Map<number, string>();
  const held = new Map<number, string>();
  const chat = [text];

  for (const entry of entries) {
    if (entry.enabled === false) {
      const key = firstMatchingKey(chat, entry);
      if (key) missed.set(entry.id, `${entryLabel(entry)} — "${key}", but disabled`);
      continue;
    }
    if (entry.constant) {
      active.set(entry.id, { entry, reason: 'constant' });
      continue;
    }
    const key = firstMatchingKey(chat, entry);
    if (!key) continue;
    if (entry.delayUntilRecursion) {
      missed.set(entry.id, `${entryLabel(entry)} — "${key}", but delayUntilRecursion and no recursive pass reached it`);
      held.set(entry.id, key);
      continue;
    }
    const failure = secondaryKeyFailure(entry, chat);
    if (failure) {
      missed.set(entry.id, `${entryLabel(entry)} — "${key}", but ${failure}`);
      held.set(entry.id, key);
      continue;
    }
    active.set(entry.id, { entry, reason: `"${key}"` });
  }

  const recursive = book.recursive_scanning === true;
  const passCapReached = recursive && runRecursivePasses(entries, text, active, missed, held);

  const activations = [...active.values()];
  let tokens = 0;
  for (const activation of activations) tokens += estimateTokens(activation.entry.content ?? '');
  const budget = book.token_budget;
  const budgetNote = budget ? (tokens > budget ? `, over token_budget ${budget}` : ` of token_budget ${budget}`) : '';

  const lines = [
    `Key test — ${activations.length} of ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} activate, ~${tokens} tokens${budgetNote}; recursive_scanning ${recursive ? 'on' : 'off'}`,
  ];

  if (activations.length === 0) {
    lines.push('Active: (none)');
  } else {
    lines.push('Active:');
    for (const activation of activations.slice(0, MAX_ACTIVE_LINES)) {
      lines.push(`- ${entryLabel(activation.entry)} — ${activation.reason}${chanceNote(activation.entry)}`);
    }
    if (activations.length > MAX_ACTIVE_LINES) lines.push(`…and ${activations.length - MAX_ACTIVE_LINES} more`);
  }

  const missedLines = [...missed.values()];
  if (missedLines.length > 0) {
    lines.push('Key hit but not active:');
    for (const line of missedLines.slice(0, MAX_MISSED_LINES)) lines.push(`- ${line}`);
    if (missedLines.length > MAX_MISSED_LINES) lines.push(`…and ${missedLines.length - MAX_MISSED_LINES} more`);
  }

  if (passCapReached) {
    lines.push(`Recursion stopped after ${MAX_RECURSION_PASSES} passes; more entries may chain from there.`);
  }
  lines.push('Approximate: no earlier chat messages (scan_depth), inclusion groups, timed effects, or budget cuts.');
  return lines.join('\n');
}
