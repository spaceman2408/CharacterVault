import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MACRO_HIGHLIGHT_SETTINGS,
  normalizeMacroHighlight,
} from '../../src/db/characterTypes';

describe('normalizeMacroHighlight', () => {
  it('defaults to automatic (blank) for missing input', () => {
    expect(normalizeMacroHighlight(undefined)).toEqual(DEFAULT_MACRO_HIGHLIGHT_SETTINGS);
    expect(normalizeMacroHighlight(null)).toEqual({ char: '', user: '' });
  });

  it('keeps valid custom colors', () => {
    expect(normalizeMacroHighlight({ char: '#ff0000', user: '#00ff00' })).toEqual({
      char: '#ff0000',
      user: '#00ff00',
    });
  });

  it('repairs invalid colors to automatic', () => {
    expect(normalizeMacroHighlight({ char: 'red', user: '#xyz' })).toEqual({
      char: '',
      user: '',
    });
  });

  it('expands shorthand hex', () => {
    expect(normalizeMacroHighlight({ char: '#abc', user: '' })).toEqual({
      char: '#aabbcc',
      user: '',
    });
  });
});
