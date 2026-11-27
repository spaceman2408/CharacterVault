import { describe, expect, it } from 'vitest';
import { formatToolEvent } from '../../../src/agent/ui/formatToolEvent';
import type { AgentToolEvent } from '../../../src/agent/ui/types';

function event(
  toolName: string,
  message: string,
  ok = true,
): AgentToolEvent {
  return { toolName, ok, message };
}

describe('formatToolEvent', () => {
  it('names what each lookup looked at, from its kept header', () => {
    const lines: [string, string, string][] = [
      ['list_fields', 'Current card fields (id, token size; bodies omitted):', 'Listed fields'],
      ['read_field', 'description (Description) — 7 tokens', 'Read Description'],
      ['list_greetings', 'Alternate greetings (1):', 'Listed 1 alternate greeting'],
      ['read_greeting', 'greeting 2/3', 'Read greeting 2 of 3'],
      ['read_entry', '#4 The Red Keep', 'Read “The Red Keep” (#4)'],
      ['search', '4 matches in 3 places for "harbor"', 'Searched “harbor” (4 matches)'],
      ['search', '0 matches for "\\"dock\\""', 'Searched “"dock"” (no matches)'],
      ['audit_card', 'Card audit — 2/4 required filled', 'Checked the card'],
      ['audit_book', 'Book audit — 3 entries', 'Checked the book'],
      ['read_recursion', 'Recursion map — 1 entry, 0 edges', 'Read the recursion map'],
      ['test_keys', 'Key test — 1 of 1 entry activate', 'Tested keys'],
      ['suggest_names', 'suggest_names: 8 first names, any, british', 'Suggested 8 names'],
      ['suggest_places', 'suggest_places: 12 invented towns, british', 'Suggested 12 places'],
      ['suggest_places', 'suggest_places: 1 grounded tavern', 'Suggested 1 place'],
      ['read_skill', 'Skill: Greeting Writer', 'Used skill “Greeting Writer”'],
    ];
    for (const [tool, message, label] of lines) expect(formatToolEvent(event(tool, message))).toBe(label);
  });

  it('turns field replacements into a readable line without the full field size', () => {
    expect(
      formatToolEvent(
        event(
          'replace_in_field',
          'ok description (Description) — replaced 2 (3849 tokens)',
        ),
      ),
    ).toBe('Replaced 2 in Description');
    expect(
      formatToolEvent(
        event(
          'replace_in_field',
          'ok creator_notes (Creator Notes) — replaced 2 (28961 tokens)',
        ),
      ),
    ).toBe('Replaced 2 in Creator Notes');
  });

  it('turns lorebook replacements into a readable line', () => {
    expect(
      formatToolEvent(
        event('replace_in_entry', 'ok #6 Suemon Syndrome (The Lunar Chill) — replaced 1'),
      ),
    ).toBe('Replaced 1 in “Suemon Syndrome (The Lunar Chill)” (#6)');
    expect(
      formatToolEvent(event('replace_in_entry', 'ok #13 ember-salt hydrotherapy — replaced 1')),
    ).toBe('Replaced 1 in “ember-salt hydrotherapy” (#13)');
    expect(
      formatToolEvent(
        event('replace_in_entry', 'ok #14 resonance exposure therapy — replaced 2'),
      ),
    ).toBe('Replaced 2 in “resonance exposure therapy” (#14)');
  });

  it('keeps add/update/delete entry wording', () => {
    expect(formatToolEvent(event('add_entry', 'ok #24 Prime Days'))).toBe(
      'Added “Prime Days” (#24)',
    );
    expect(formatToolEvent(event('update_entry', 'ok #4 The Red Keep'))).toBe(
      'Updated “The Red Keep” (#4)',
    );
    expect(formatToolEvent(event('delete_entry', 'ok #5 Elsewhere'))).toBe(
      'Deleted “Elsewhere” (#5)',
    );
  });

  it('leaves the result notes out of the entry name', () => {
    expect(
      formatToolEvent(event('update_entry', 'ok #4 The Red Keep — ignored unknown fields: recursion, Depth')),
    ).toBe('Updated “The Red Keep” (#4)');
    expect(
      formatToolEvent(
        event('update_entry', 'ok #4 The Red Keep — now excludeRecursion: true — ignored unknown fields: recursion'),
      ),
    ).toBe('Updated “The Red Keep” (#4)');
    expect(formatToolEvent(event('add_entry', 'ok #0 Harbor — now position: at_depth, depth: 4'))).toBe(
      'Added “Harbor” (#0)',
    );
    expect(
      formatToolEvent(
        event(
          'update_entry',
          'ok #4 Keep — now delayUntilRecursion: true — warning: excludeRecursion with delayUntilRecursion means this entry never activates',
        ),
      ),
    ).toBe('Updated “Keep” (#4)');
  });

  it('says No change when a write changed nothing', () => {
    expect(
      formatToolEvent(event('update_entry', 'ok #4 The Red Keep — no change, already excludeRecursion: true')),
    ).toBe('No change to “The Red Keep” (#4)');
    expect(formatToolEvent(event('update_entry', 'ok #4 The Red Keep — no change'))).toBe(
      'No change to “The Red Keep” (#4)',
    );
    expect(
      formatToolEvent(event('update_book_settings', 'ok Book settings: scan_depth: 4; recursive_scanning: on — no change')),
    ).toBe('No change to book settings');
    expect(formatToolEvent(event('update_book_settings', 'ok Book settings: scan_depth: 4'))).toBe(
      'Updated book settings',
    );
  });

  it('formats field updates, greetings, and lists', () => {
    expect(
      formatToolEvent(event('update_field', 'ok description (Description) — 3849 tokens')),
    ).toBe('Updated Description (3849 tokens)');
    expect(formatToolEvent(event('add_greeting', 'ok greeting 3/3'))).toBe(
      'Added greeting 3 of 3',
    );
    expect(
      formatToolEvent(event('replace_in_greeting', 'ok greeting 1/3 — replaced 1')),
    ).toBe('Replaced 1 in greeting 1 of 3');
    expect(
      formatToolEvent(event('delete_greeting', 'ok deleted greeting 1; 2 remaining')),
    ).toBe('Deleted greeting 1 (2 remaining)');
    expect(formatToolEvent(event('list_entries', '24 entries'))).toBe('Listed 24 entries');
    expect(
      formatToolEvent(event('append_to_field', 'ok personality (Personality) — 40 tokens')),
    ).toBe('Appended to Personality (40 tokens)');
    expect(
      formatToolEvent(
        event('replace_across', 'ok replaced 7 in 4 places: description, greeting 1, #4 The Red Keep'),
      ),
    ).toBe('Replaced 7 in 4 places');
    expect(
      formatToolEvent(event('move_greeting', 'ok moved greeting 3 → 1 (4 greetings)')),
    ).toBe('Moved greeting 3 to 1');
    expect(
      formatToolEvent(event('update_book_settings', 'ok Book settings: scan_depth: 4; token_budget: 512')),
    ).toBe('Updated book settings');
  });

  it('formats failures with a clear prefix and stripped error tag', () => {
    expect(
      formatToolEvent(
        event(
          'replace_in_field',
          'error: old not found (re-read and copy a unique snippet, or rewrite the whole value)',
          false,
        ),
      ),
    ).toBe(
      "Couldn't replace in field: old not found (re-read and copy a unique snippet, or rewrite the whole value)",
    );
    expect(
      formatToolEvent(
        event('replace_in_entry', 'error: old matches 2 times; pass replace_all true or a longer unique snippet', false),
      ),
    ).toBe(
      "Couldn't replace in entry: old matches 2 times; pass replace_all true or a longer unique snippet",
    );
    expect(
      formatToolEvent(event('update_field', 'limit: max 30 field updates per run', false)),
    ).toBe("Couldn't update field: max 30 field updates per run");
    expect(
      formatToolEvent(
        event(
          'incomplete_action',
          'incomplete_action: a tool_call was not closed with </tool_call>',
          false,
        ),
      ),
    ).toBe('Incomplete action: a tool_call was not closed with </tool_call>');
  });

  it('does not throw on a regex-hostile tool name and keeps unknown-action labels', () => {
    expect(() =>
      formatToolEvent(event('a(', 'error: boom', false)),
    ).not.toThrow();
    expect(
      formatToolEvent(event('unknown_action', 'unknown_action: frobnicate', false)),
    ).toContain('Unknown action');
  });
});
