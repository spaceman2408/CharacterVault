import { useCallback, useState } from 'react';

export type CreatorNotesPreviewWidth = 'full' | 'wide' | 'panel' | 'phone';
export type CreatorNotesPreviewBackdrop = 'dark' | 'light' | 'checker';

export interface CreatorNotesPreviewPrefs {
  matchSillyTavern: boolean;
  allowRemoteMedia: boolean;
  width: CreatorNotesPreviewWidth;
  backdrop: CreatorNotesPreviewBackdrop;
  /** Editor share of the docked split, 0–1. */
  splitRatio: number;
}

export const CREATOR_NOTES_PREVIEW_WIDTHS: Record<CreatorNotesPreviewWidth, number | null> = {
  full: null,
  wide: 720,
  panel: 480,
  phone: 390,
};

const STORAGE_KEY = 'creatorNotesPreviewPrefs';

export const MIN_SPLIT_RATIO = 0.2;
export const MAX_SPLIT_RATIO = 0.8;
export const DEFAULT_SPLIT_RATIO = 0.5;

export function clampSplitRatio(ratio: number): number {
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio));
}

const DEFAULT_PREFS: CreatorNotesPreviewPrefs = {
  matchSillyTavern: true,
  allowRemoteMedia: false,
  width: 'full',
  backdrop: 'dark',
  splitRatio: DEFAULT_SPLIT_RATIO,
};

function readPrefs(): CreatorNotesPreviewPrefs {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFS;
    const raw = parsed as Partial<Record<keyof CreatorNotesPreviewPrefs, unknown>>;
    return {
      matchSillyTavern: typeof raw.matchSillyTavern === 'boolean' ? raw.matchSillyTavern : DEFAULT_PREFS.matchSillyTavern,
      allowRemoteMedia: typeof raw.allowRemoteMedia === 'boolean' ? raw.allowRemoteMedia : DEFAULT_PREFS.allowRemoteMedia,
      width: typeof raw.width === 'string' && raw.width in CREATOR_NOTES_PREVIEW_WIDTHS
        ? (raw.width as CreatorNotesPreviewWidth)
        : DEFAULT_PREFS.width,
      backdrop: raw.backdrop === 'dark' || raw.backdrop === 'light' || raw.backdrop === 'checker'
        ? raw.backdrop
        : DEFAULT_PREFS.backdrop,
      splitRatio: typeof raw.splitRatio === 'number' && Number.isFinite(raw.splitRatio)
        ? clampSplitRatio(raw.splitRatio)
        : DEFAULT_PREFS.splitRatio,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Per-viewer Creator Notes preview choices, remembered in this browser. */
export function useCreatorNotesPreviewPrefs(): [
  CreatorNotesPreviewPrefs,
  (patch: Partial<CreatorNotesPreviewPrefs>) => void,
] {
  const [prefs, setPrefs] = useState(readPrefs);

  const updatePrefs = useCallback((patch: Partial<CreatorNotesPreviewPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Private mode or blocked storage: the choice just isn't remembered.
      }
      return next;
    });
  }, []);

  return [prefs, updatePrefs];
}
