import type { ChatOwnerType, ChatPanel } from '../../db/characterTypes';

interface RunThread {
  ownerType: ChatOwnerType;
  ownerId: string;
  panel: ChatPanel;
}

export interface RunMarker {
  reviewWaiting: boolean;
}

const KEY_PREFIX = 'cv-agent-run:';

function keyFor(thread: RunThread): string {
  return `${KEY_PREFIX}${thread.ownerType}:${thread.ownerId}:${thread.panel}`;
}

/**
 * Marks a thread as having agent writes that are not saved yet. A page refresh
 * or close never runs the end-of-run save, so a marker still present on the
 * next load means that run's writes were lost.
 */
export function writeRunMarker(thread: RunThread, marker: RunMarker, storage: Storage = localStorage): void {
  if (!thread.ownerId) return;
  try {
    storage.setItem(keyFor(thread), JSON.stringify(marker));
  } catch {
    // Storage can be unavailable; the run itself must not fail over it.
  }
}

export function readRunMarker(thread: RunThread, storage: Storage = localStorage): RunMarker | null {
  if (!thread.ownerId) return null;
  try {
    const raw = storage.getItem(keyFor(thread));
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as Partial<RunMarker>;
    return { reviewWaiting: parsed.reviewWaiting === true };
  } catch {
    return null;
  }
}

/** With `keepReview`, a marker held for a waiting review stays until that review settles. */
export function clearRunMarker(
  thread: RunThread,
  { keepReview = false }: { keepReview?: boolean } = {},
  storage: Storage = localStorage,
): void {
  if (!thread.ownerId) return;
  if (keepReview && readRunMarker(thread, storage)?.reviewWaiting) return;
  try {
    storage.removeItem(keyFor(thread));
  } catch {
    // See writeRunMarker.
  }
}
