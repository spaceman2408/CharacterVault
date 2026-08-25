import { describe, expect, it } from 'vitest';
import { buildCharacterAgentSystemPrompt } from '../../../../src/agent/hosts/character/prompt';

const SHARED_EXPECTATIONS = [
  'list_fields',
  'read_field',
  'update_field',
  'replace_in_field',
  'replace_in_greeting',
  'add_greeting',
  'add_entry',
  'read_entry',
  'replace_in_entry',
  'search',
  'replace_across',
  'append_to_field',
  'audit_card',
  'move_greeting',
  'update_book_settings',
  'read_recursion',
  'excludeRecursion',
  'insertion_order',
  'personality and physical_description may stay empty',
  'system_prompt, post_history_instructions, and scenario are optional',
  'description does not need to cover them',
  'Active / Inactive split',
  'one greeting as the opening',
] as const;

describe('buildCharacterAgentSystemPrompt', () => {
  it('teaches native functions only by default', () => {
    const prompt = buildCharacterAgentSystemPrompt([]);
    expect(prompt).toContain('provided functions');
    expect(prompt).not.toContain('<tool_call>');
    expect(prompt).not.toContain('Prefer those over XML');
    for (const snippet of SHARED_EXPECTATIONS) {
      expect(prompt).toContain(snippet);
    }
    expect(prompt).not.toContain('Lorebook tab');
    expect(prompt).not.toContain('<<<');
    expect(prompt).not.toContain('>>>');
    expect(prompt).not.toContain('look and personality');
    expect(prompt).not.toContain('(Appearance)');
  });

  it('teaches XML tool_call for card fields and does not mention custom fences', () => {
    const prompt = buildCharacterAgentSystemPrompt([], 'xml');
    expect(prompt).toContain('<tool_call>');
    expect(prompt).toContain('</tool_call>');
    expect(prompt).not.toContain('provided functions');
    for (const snippet of SHARED_EXPECTATIONS) {
      expect(prompt).toContain(snippet);
    }
    expect(prompt).not.toContain('Lorebook tab');
    expect(prompt).not.toContain('<<<');
    expect(prompt).not.toContain('>>>');
    expect(prompt).toContain('Never write the word tool_name');
    expect(prompt).not.toContain('look and personality');
    expect(prompt).not.toContain('(Appearance)');
  });
});
