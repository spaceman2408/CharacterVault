import { describe, expect, it } from 'vitest';
import { buildLorebookAgentSystemPrompt } from '../../../../src/agent/hosts/lorebook/prompt';

const TOOL_NAMES = [
  'list_entries',
  'read_entry',
  'add_entry',
  'update_entry',
  'replace_in_entry',
  'delete_entry',
  'search',
  'replace_across',
  'audit_book',
  'read_recursion',
  'excludeRecursion',
  'update_book_settings',
  'insertion_order',
] as const;

describe('buildLorebookAgentSystemPrompt', () => {
  it('teaches native functions only by default', () => {
    const prompt = buildLorebookAgentSystemPrompt([]);
    expect(prompt).toContain('provided functions');
    expect(prompt).not.toContain('<tool_call>');
    expect(prompt).not.toContain('</tool_call>');
    expect(prompt).not.toContain('Prefer those over XML');
    for (const name of TOOL_NAMES) {
      expect(prompt).toContain(name);
    }
    expect(prompt).toContain('already in context');
    expect(prompt).not.toContain('Do not update or delete existing entries');
    expect(prompt).not.toContain('Call list_entries before adding');
    expect(prompt).not.toContain('<<<');
    expect(prompt).not.toContain('>>>');
  });

  it('teaches XML tool_call and does not mention custom fences', () => {
    const prompt = buildLorebookAgentSystemPrompt([], 'xml');
    expect(prompt).toContain('<tool_call>');
    expect(prompt).toContain('</tool_call>');
    expect(prompt).not.toContain('provided functions');
    for (const name of TOOL_NAMES) {
      expect(prompt).toContain(name);
    }
    expect(prompt).toContain('already in context');
    expect(prompt).not.toContain('Do not update or delete existing entries');
    expect(prompt).not.toContain('Call list_entries before adding');
    expect(prompt).not.toContain('<<<');
    expect(prompt).not.toContain('>>>');
    expect(prompt).toContain('Never write the word tool_name');
    expect(prompt).not.toContain('never JSON');
  });
});
