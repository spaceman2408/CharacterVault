import { describe, expect, it } from 'vitest';
import { buildCharacterAgentSystemPrompt } from '../../../../src/agent/hosts/character/prompt';

describe('buildCharacterAgentSystemPrompt', () => {
  it('teaches XML tool_call for card fields and does not mention custom fences', () => {
    const prompt = buildCharacterAgentSystemPrompt([]);
    expect(prompt).toContain('<tool_call>');
    expect(prompt).toContain('</tool_call>');
    expect(prompt).toContain('list_fields');
    expect(prompt).toContain('read_field');
    expect(prompt).toContain('update_field');
    expect(prompt).toContain('replace_in_field');
    expect(prompt).toContain('replace_in_greeting');
    expect(prompt).toContain('add_greeting');
    expect(prompt).toContain('add_entry');
    expect(prompt).toContain('read_entry');
    expect(prompt).toContain('replace_in_entry');
    expect(prompt).toContain('search');
    expect(prompt).toContain('replace_across');
    expect(prompt).toContain('append_to_field');
    expect(prompt).toContain('audit_card');
    expect(prompt).toContain('move_greeting');
    expect(prompt).toContain('update_book_settings');
    expect(prompt).toContain('read_recursion');
    expect(prompt).toContain('excludeRecursion');
    expect(prompt).toContain('insertion_order');
    expect(prompt).not.toContain('Lorebook tab');
    expect(prompt).not.toContain('<<<');
    expect(prompt).not.toContain('>>>');
    expect(prompt).toContain('Never write the word tool_name');
    expect(prompt).toContain('native');
  });
});
