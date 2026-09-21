import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS,
  normalizeRoleplayHighlight,
} from '../../src/db/characterTypes';

describe('normalizeRoleplayHighlight', () => {
  it('returns defaults for missing input', () => {
    expect(normalizeRoleplayHighlight(undefined)).toEqual(DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS);
    expect(normalizeRoleplayHighlight(null)).toEqual(DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS);
  });

  it('defaults narration to editor text (empty)', () => {
    expect(normalizeRoleplayHighlight(undefined).narration).toBe('');
    expect(normalizeRoleplayHighlight({}).narration).toBe('');
  });

  it('keeps valid values', () => {
    expect(
      normalizeRoleplayHighlight({
        enabled: true,
        dialogue: '#ff0000',
        narration: '#00ff00',
        action: '#0000ff',
      }),
    ).toEqual({ enabled: true, dialogue: '#ff0000', narration: '#00ff00', action: '#0000ff' });
  });

  it('repairs invalid colors and flags', () => {
    expect(
      normalizeRoleplayHighlight({
        enabled: 'yes',
        dialogue: 'red',
        narration: '#xyz',
        action: '#gggggg',
      }),
    ).toEqual({
      enabled: true,
      dialogue: DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS.dialogue,
      narration: '',
      action: DEFAULT_ROLEPLAY_HIGHLIGHT_SETTINGS.action,
    });
  });

  it('expands shorthand hex', () => {
    expect(normalizeRoleplayHighlight({ narration: '#abc' }).narration).toBe('#aabbcc');
  });

  it('migrates the retired gray narration default to editor text', () => {
    expect(normalizeRoleplayHighlight({ narration: '#6b7280' }).narration).toBe('');
  });

  it('respects an explicit opt-out', () => {
    expect(normalizeRoleplayHighlight({ enabled: false }).enabled).toBe(false);
  });
});
