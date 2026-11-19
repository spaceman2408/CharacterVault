// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useCreatorNotesPreviewPrefs } from '../../../src/components/editor/useCreatorNotesPreviewPrefs';

const KEY = 'creatorNotesPreviewPrefs';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('useCreatorNotesPreviewPrefs', () => {
  it('starts with SillyTavern matching on and remote media blocked', () => {
    const { result } = renderHook(() => useCreatorNotesPreviewPrefs());
    expect(result.current[0]).toEqual({
      matchSillyTavern: true,
      allowRemoteMedia: false,
      width: 'full',
      backdrop: 'dark',
      splitRatio: 0.5,
    });
  });

  it('remembers changes for the next mount', () => {
    const first = renderHook(() => useCreatorNotesPreviewPrefs());
    act(() => first.result.current[1]({ width: 'phone', backdrop: 'checker' }));
    first.unmount();

    const second = renderHook(() => useCreatorNotesPreviewPrefs());
    expect(second.result.current[0]).toMatchObject({ width: 'phone', backdrop: 'checker', matchSillyTavern: true });
  });

  it('falls back per field on bad stored values', () => {
    localStorage.setItem(KEY, JSON.stringify({ width: 'huge', backdrop: 'light', matchSillyTavern: 'yes' }));
    const { result } = renderHook(() => useCreatorNotesPreviewPrefs());
    expect(result.current[0]).toEqual({
      matchSillyTavern: true,
      allowRemoteMedia: false,
      width: 'full',
      backdrop: 'light',
      splitRatio: 0.5,
    });
  });

  it('clamps a stored split ratio', () => {
    localStorage.setItem(KEY, JSON.stringify({ splitRatio: 0.95 }));
    const { result } = renderHook(() => useCreatorNotesPreviewPrefs());
    expect(result.current[0].splitRatio).toBe(0.8);
  });

  it('ignores unreadable storage', () => {
    localStorage.setItem(KEY, '{not json');
    const { result } = renderHook(() => useCreatorNotesPreviewPrefs());
    expect(result.current[0].width).toBe('full');
  });
});
