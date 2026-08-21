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
  it('turns field replacements into a readable line without the full field size', () => {
    expect(
      formatToolEvent(
        event(
          'replace_in_field',
          'ok description (Description) — replaced 2 (3849 chars)',
        ),
      ),
    ).toBe('Replaced 2 in Description');
    expect(
      formatToolEvent(
        event(
          'replace_in_field',
          'ok creator_notes (Creator Notes) — replaced 2 (28961 chars)',
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

  it('formats field updates, greetings, and lists', () => {
    expect(
      formatToolEvent(event('update_field', 'ok description (Description) — 3849 chars')),
    ).toBe('Updated Description (3849 chars)');
    expect(formatToolEvent(event('add_greeting', 'ok greeting 2/3'))).toBe(
      'Added greeting 3 of 3',
    );
    expect(
      formatToolEvent(event('replace_in_greeting', 'ok greeting 0/3 — replaced 1')),
    ).toBe('Replaced 1 in greeting 1 of 3');
    expect(
      formatToolEvent(event('delete_greeting', 'ok deleted greeting 0; 2 remaining')),
    ).toBe('Deleted greeting 1 (2 remaining)');
    expect(formatToolEvent(event('list_entries', '24 entries'))).toBe('Listed 24 entries');
  });

  it('formats failures with a clear prefix and stripped error tag', () => {
    expect(
      formatToolEvent(
        event('replace_in_field', 'error: old not found (copy the exact text from read)', false),
      ),
    ).toBe("Couldn't replace in field — old not found (copy the exact text from read)");
    expect(
      formatToolEvent(
        event('replace_in_entry', 'error: old matches 2 times; pass replace_all true or a longer unique snippet', false),
      ),
    ).toBe(
      "Couldn't replace in entry — old matches 2 times; pass replace_all true or a longer unique snippet",
    );
    expect(
      formatToolEvent(event('update_field', 'limit: max 30 field updates per run', false)),
    ).toBe("Couldn't update field — max 30 field updates per run");
    expect(
      formatToolEvent(
        event(
          'incomplete_action',
          'incomplete_action: a tool_call was not closed with </tool_call>',
          false,
        ),
      ),
    ).toBe('Incomplete action — a tool_call was not closed with </tool_call>');
  });
});
