/**
 * Pure helpers for history modal open / snapshot load lifecycle.
 * Kept free of React so they can be unit-tested.
 */

import type {
  Character,
  CharacterSnapshot,
  SnapshotDiffEntry,
} from '../db/characterTypes';

export interface OpenHistoryAfterFlushOptions {
  flush: () => Promise<unknown>;
  setOpen: (open: boolean) => void;
  /** When true, skip starting another flush/open (double-click guard). */
  isOpening?: boolean;
  setIsOpening?: (busy: boolean) => void;
}

/**
 * Flush pending character saves, then open the history modal.
 * If flush throws, the modal is not opened.
 */
export async function openHistoryAfterFlush({
  flush,
  setOpen,
  isOpening = false,
  setIsOpening,
}: OpenHistoryAfterFlushOptions): Promise<boolean> {
  if (isOpening) {
    return false;
  }

  setIsOpening?.(true);
  try {
    await flush();
    setOpen(true);
    return true;
  } catch {
    return false;
  } finally {
    setIsOpening?.(false);
  }
}

export function shouldComputePayloadHash(isModalVisible: boolean): boolean {
  return isModalVisible;
}

export interface SnapshotDiffLoader {
  loadSnapshotForDiff(snapshotId: string): Promise<CharacterSnapshot | undefined>;
  diffSnapshotAgainstCharacter(
    snapshot: CharacterSnapshot,
    character: Character,
  ): Promise<SnapshotDiffEntry[]>;
}

/**
 * Load a snapshot once and compute its diff against the current character.
 * Avoids a second payload fetch for the selected-revision UI.
 */
export async function loadSnapshotDiff(
  snapshotId: string,
  character: Character,
  loader: SnapshotDiffLoader,
): Promise<{ snapshot: CharacterSnapshot | null; entries: SnapshotDiffEntry[] }> {
  const snapshot = await loader.loadSnapshotForDiff(snapshotId);
  if (!snapshot) {
    return { snapshot: null, entries: [] };
  }

  const entries = await loader.diffSnapshotAgainstCharacter(snapshot, character);
  return { snapshot, entries };
}
