import type { CharacterBook, CharacterSpec, LorebookEntry } from '../../db/characterTypes';
import {
  fieldLabel,
  getFieldValue,
  parseCommaList,
  setFieldValue,
  type CharacterAgentFieldId,
} from '../hosts/character/fields';
import type {
  AgentReviewChange,
  AppliedCharacterReview,
  CharacterReviewPayload,
  LorebookReviewPayload,
  ReviewDecisions,
} from './types';

export const REVIEWABLE_SPEC_FIELDS: CharacterAgentFieldId[] = [
  'name',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'system_prompt',
  'post_history_instructions',
  'physical_description',
  'creator',
  'creator_notes',
  'character_version',
  'avatar',
  'tags',
];

const BOOK_SETTING_KEYS = [
  'name',
  'description',
  'scan_depth',
  'token_budget',
  'recursive_scanning',
] as const;

export function specFieldText(spec: CharacterSpec, fieldId: CharacterAgentFieldId): string {
  return getFieldValue(spec, fieldId);
}

export function parseTagsList(raw: string): string[] {
  return parseCommaList(raw);
}

export function entryTitle(entry: LorebookEntry): string {
  return entry.comment || entry.name || `Entry #${entry.id}`;
}

function cloneBook(book: CharacterBook): CharacterBook {
  return structuredClone(book);
}

function cloneSpecShallow(spec: CharacterSpec): CharacterSpec {
  return {
    ...spec,
    alternate_greetings: [...(spec.alternate_greetings ?? [])],
    tags: spec.tags ? [...spec.tags] : spec.tags,
  };
}

export function diffSpecChanges(
  original: CharacterSpec,
  proposed: CharacterSpec,
): AgentReviewChange[] {
  const changes: AgentReviewChange[] = [];
  for (const id of REVIEWABLE_SPEC_FIELDS) {
    const before = specFieldText(original, id);
    const after = specFieldText(proposed, id);
    if (before !== after) {
      changes.push({ id: `field:${id}`, kind: 'field', fieldId: id, label: fieldLabel(id), before, after });
    }
  }

  const beforeGreetings = original.alternate_greetings ?? [];
  const afterGreetings = proposed.alternate_greetings ?? [];
  if (JSON.stringify(beforeGreetings) !== JSON.stringify(afterGreetings)) {
    if (beforeGreetings.length === afterGreetings.length) {
      afterGreetings.forEach((after, index) => {
        const before = beforeGreetings[index] ?? '';
        if (before !== after) {
          changes.push({ id: `greeting:${index}`, kind: 'greeting', index, before, after });
        }
      });
    } else {
      changes.push({
        id: 'greetings',
        kind: 'greetings',
        before: [...beforeGreetings],
        after: [...afterGreetings],
      });
    }
  }
  return changes;
}

export function diffBookChanges(
  original: CharacterBook,
  proposed: CharacterBook,
): AgentReviewChange[] {
  const changes: AgentReviewChange[] = [];
  const beforeById = new Map<number, LorebookEntry>();
  for (const entry of original.entries ?? []) beforeById.set(entry.id, entry);
  const afterById = new Map<number, LorebookEntry>();
  for (const entry of proposed.entries ?? []) afterById.set(entry.id, entry);

  for (const entry of proposed.entries ?? []) {
    const before = beforeById.get(entry.id);
    if (!before) {
      changes.push({
        id: `entry-added:${entry.id}`,
        kind: 'entry-added',
        entryId: entry.id,
        title: entryTitle(entry),
        keys: [...(entry.keys ?? [])],
        content: entry.content ?? '',
      });
    } else if (JSON.stringify(before) !== JSON.stringify(entry)) {
      const beforeKeys = before.keys ?? [];
      const afterKeys = entry.keys ?? [];
      changes.push({
        id: `entry-updated:${entry.id}`,
        kind: 'entry-updated',
        entryId: entry.id,
        title: entryTitle(entry),
        beforeContent: before.content ?? '',
        afterContent: entry.content ?? '',
        beforeKeys,
        afterKeys,
        metaChanged: metaOfEntry(before) !== metaOfEntry(entry),
      });
    }
  }

  for (const entry of original.entries ?? []) {
    if (!afterById.has(entry.id)) {
      changes.push({
        id: `entry-deleted:${entry.id}`,
        kind: 'entry-deleted',
        entryId: entry.id,
        title: entryTitle(entry),
        content: entry.content ?? '',
      });
    }
  }

  const summary: string[] = [];
  for (const key of BOOK_SETTING_KEYS) {
    const before = original[key];
    const after = proposed[key];
    if (JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)) {
      summary.push(`${key}: ${formatSettingValue(before)} → ${formatSettingValue(after)}`);
    }
  }
  if (summary.length > 0) {
    changes.push({ id: 'book-settings', kind: 'book-settings', summary });
  }
  return changes;
}

function formatSettingValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  return String(value);
}

function metaOfEntry(entry: LorebookEntry): string {
  return JSON.stringify(entry, (key, value: unknown) =>
    key === 'content' || key === 'keys' ? undefined : value,
  );
}

export function diffCharacterReview(payload: CharacterReviewPayload): AgentReviewChange[] {
  const changes: AgentReviewChange[] = [];
  if (payload.proposedSpec) {
    changes.push(...diffSpecChanges(payload.originalSpec, payload.proposedSpec));
  }
  if (payload.proposedBook) {
    changes.push(...diffBookChanges(payload.originalBook, payload.proposedBook));
  }
  return changes;
}

export function diffLorebookReview(payload: LorebookReviewPayload): AgentReviewChange[] {
  return diffBookChanges(payload.originalBook, payload.proposedBook);
}

export function defaultDecisions(changes: AgentReviewChange[]): ReviewDecisions {
  const decisions: ReviewDecisions = {};
  for (const change of changes) decisions[change.id] = { approved: true };
  return decisions;
}

export function countApproved(decisions: ReviewDecisions): number {
  return Object.values(decisions).filter((decision) => decision.approved).length;
}

/**
 * Applies approved review decisions onto a base spec. The base is usually the
 * live card at apply time (not the run-start original) so concurrent editor
 * edits to untouched fields survive the apply.
 */
export function applySpecDecisions(
  base: CharacterSpec,
  changes: AgentReviewChange[],
  decisions: ReviewDecisions,
): CharacterSpec | undefined {
  let changed = false;
  let next = cloneSpecShallow(base);
  for (const change of changes) {
    const decision = decisions[change.id];
    if (!decision?.approved) continue;
    if (change.kind === 'field') {
      next = setFieldValue(next, change.fieldId, decision.edited ?? change.after);
      changed = true;
    } else if (change.kind === 'greeting') {
      const greetings = [...(next.alternate_greetings ?? [])];
      if (change.index >= greetings.length) continue;
      greetings[change.index] = decision.edited ?? change.after;
      next.alternate_greetings = greetings;
      changed = true;
    } else if (change.kind === 'greetings') {
      const lines =
        decision.edited != null ? decision.edited.split('\n') : [...change.after];
      if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
      next.alternate_greetings = lines;
      changed = true;
    }
  }
  if (!changed) return undefined;
  return next;
}

/**
 * Applies approved review decisions onto a base book. Added entries are
 * rebased to fresh ids when the id is already taken in the base (the user may
 * have added entries while the review was staged). Updates targeting entries
 * that no longer exist are skipped — the newer delete wins.
 */
export function applyBookDecisions(
  base: CharacterBook,
  proposed: CharacterBook,
  changes: AgentReviewChange[],
  decisions: ReviewDecisions,
): CharacterBook | undefined {
  let changed = false;
  const next = cloneBook(base);
  const usedIds = new Set<number>();
  for (const entry of next.entries ?? []) usedIds.add(entry.id);
  const byId = new Map<number, LorebookEntry>();
  for (const entry of next.entries ?? []) byId.set(entry.id, entry);

  for (const change of changes) {
    const decision = decisions[change.id];
    if (!decision?.approved) continue;
    if (change.kind === 'entry-added') {
      const proposedEntry = (proposed.entries ?? []).find((entry) => entry.id === change.entryId);
      if (!proposedEntry) continue;
      const entry = structuredClone(proposedEntry);
      if (usedIds.has(entry.id)) {
        let freshId = 0;
        while (usedIds.has(freshId)) freshId += 1;
        entry.id = freshId;
      }
      if (decision.edited != null) entry.content = decision.edited;
      if (decision.editedKeys != null) entry.keys = [...decision.editedKeys];
      next.entries = [...(next.entries ?? []), entry];
      usedIds.add(entry.id);
      byId.set(entry.id, entry);
      changed = true;
    } else if (change.kind === 'entry-updated') {
      const current = byId.get(change.entryId);
      const proposedEntry = (proposed.entries ?? []).find((entry) => entry.id === change.entryId);
      if (!current || !proposedEntry) continue;
      const merged: LorebookEntry = { ...structuredClone(proposedEntry) };
      if (decision.edited != null) merged.content = decision.edited;
      if (decision.editedKeys != null) merged.keys = [...decision.editedKeys];
      next.entries = (next.entries ?? []).map((entry) =>
        entry.id === change.entryId ? merged : entry,
      );
      byId.set(change.entryId, merged);
      changed = true;
    } else if (change.kind === 'entry-deleted') {
      next.entries = (next.entries ?? []).filter((entry) => entry.id !== change.entryId);
      byId.delete(change.entryId);
      changed = true;
    } else if (change.kind === 'book-settings') {
      next.name = proposed.name;
      next.description = proposed.description;
      next.scan_depth = proposed.scan_depth;
      next.token_budget = proposed.token_budget;
      next.recursive_scanning = proposed.recursive_scanning;
      changed = true;
    }
  }
  return changed ? next : undefined;
}

export function applyCharacterReview(
  payload: CharacterReviewPayload,
  decisions: ReviewDecisions,
): AppliedCharacterReview {
  const result: AppliedCharacterReview = {};
  if (payload.proposedSpec) {
    const changes = diffSpecChanges(payload.originalSpec, payload.proposedSpec);
    const spec = applySpecDecisions(payload.originalSpec, changes, decisions);
    if (spec) result.spec = spec;
  }
  if (payload.proposedBook) {
    const changes = diffBookChanges(payload.originalBook, payload.proposedBook);
    const book = applyBookDecisions(payload.originalBook, payload.proposedBook, changes, decisions);
    if (book) result.book = book;
  }
  return result;
}

export function applyLorebookReview(
  payload: LorebookReviewPayload,
  decisions: ReviewDecisions,
): CharacterBook | null {
  const changes = diffBookChanges(payload.originalBook, payload.proposedBook);
  return applyBookDecisions(payload.originalBook, payload.proposedBook, changes, decisions) ?? null;
}
