import { describe, expect, it } from 'vitest';
import { parseToolTarget, renumberEntryEvents } from '../../../src/agent/ui/toolTarget';
import type { AgentToolEvent } from '../../../src/agent/ui/types';

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
      index: 1,
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

describe('renumberEntryEvents', () => {
  it('points entry rows and their call ids at the saved ids', () => {
    const events: AgentToolEvent[] = [
      { toolName: 'add_entry', ok: true, message: 'ok #3 Harbor', target: { type: 'entry', id: 3 }, call: { headers: { name: 'Harbor' }, body: 'A.' } },
      { toolName: 'update_entry', ok: true, message: 'ok #3 Harbor', target: { type: 'entry', id: 3 }, call: { headers: { id: '3' }, body: 'B.' } },
      { toolName: 'update_entry', ok: true, message: 'ok #1 Guild', target: { type: 'entry', id: 1 }, call: { headers: { id: '1' }, body: 'C.' } },
    ];
    const renumbered = renumberEntryEvents(events, new Map([[3, 4]]));
    expect(renumbered.map((event) => [event.message, event.target, event.call?.headers.id])).toEqual([
      ['ok #4 Harbor', { type: 'entry', id: 4 }, undefined],
      ['ok #4 Harbor', { type: 'entry', id: 4 }, '4'],
      ['ok #1 Guild', { type: 'entry', id: 1 }, '1'],
    ]);
    expect(renumbered[2]).toBe(events[2]);
  });

  it('returns the same array when nothing moved', () => {
    const events: AgentToolEvent[] = [{ toolName: 'update_field', ok: true, message: 'ok description', target: { type: 'field', id: 'description' } }];
    expect(renumberEntryEvents(events, new Map([[3, 4]]))).toBe(events);
  });
});
