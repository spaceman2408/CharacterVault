/**
 * @fileoverview Tests for the {{char}} / {{user}} typing helper resolver.
 */

import { describe, it, expect } from 'vitest';
import { resolveMacroReplacement } from '../../src/editor/extensions/characterMacroHelper';

describe('resolveMacroReplacement', () => {
  it('resolves lowercase words', () => {
    expect(resolveMacroReplacement('char')).toBe('{{char}}');
    expect(resolveMacroReplacement('user')).toBe('{{user}}');
  });

  it('resolves case-insensitively', () => {
    expect(resolveMacroReplacement('Char')).toBe('{{char}}');
    expect(resolveMacroReplacement('CHAR')).toBe('{{char}}');
    expect(resolveMacroReplacement('User')).toBe('{{user}}');
    expect(resolveMacroReplacement('USER')).toBe('{{user}}');
    expect(resolveMacroReplacement('uSeR')).toBe('{{user}}');
  });

  it('returns null for non-macro words', () => {
    expect(resolveMacroReplacement('')).toBeNull();
    expect(resolveMacroReplacement('character')).toBeNull();
    expect(resolveMacroReplacement('users')).toBeNull();
    expect(resolveMacroReplacement('{{char}}')).toBeNull();
  });
});
