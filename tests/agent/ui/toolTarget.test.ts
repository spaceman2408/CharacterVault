import { describe, expect, it } from 'vitest';
import { parseToolTarget } from '../../../src/agent/ui/toolTarget';

describe('parseToolTarget', () => {
  it('parses field updates', () => {
    expect(
      parseToolTarget('update_field', true, 'ok description (Description) — 3849 tokens'),
    ).toEqual({ type: 'field', id: 'description' });
    expect(
      parseToolTarget('append_to_field', true, 'ok personality (Personality) — 40 tokens'),
    ).toEqual({ type: 'field', id: 'personality' });
  });

  it('parses greetings', () => {
    expect(parseToolTarget('add_greeting', true, 'ok greeting 3/3')).toEqual({
      type: 'greeting',
      index: 3,
    });
    expect(parseToolTarget('delete_greeting', true, 'ok deleted greeting 1; 2 remaining')).toEqual({
      type: 'greeting',
      index: 1,
    });
    expect(parseToolTarget('move_greeting', true, 'ok moved greeting 3 → 1 (4 greetings)')).toEqual({
      type: 'greeting',
      index: 3,
    });
  });

  it('parses lorebook entries', () => {
    expect(parseToolTarget('add_entry', true, 'ok #24 Prime Days')).toEqual({
      type: 'entry',
      id: 24,
    });
    expect(
      parseToolTarget('replace_in_entry', true, 'ok #13 ember-salt hydrotherapy — replaced 1'),
    ).toEqual({ type: 'entry', id: 13 });
  });

  it('skips failures and untargeted tools', () => {
    expect(parseToolTarget('update_field', false, 'error: unknown field')).toBeUndefined();
    expect(parseToolTarget('search', true, 'ok 3 matches')).toBeUndefined();
    expect(parseToolTarget('audit_card', true, 'ok audit')).toBeUndefined();
  });
});
