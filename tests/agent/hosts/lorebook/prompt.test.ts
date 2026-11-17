import { describe, expect, it } from 'vitest';
import { buildLorebookAgentSystemPrompt } from '../../../../src/agent/hosts/lorebook/prompt';
import { LOREBOOK_TOOL_SPECS } from '../../../../src/agent/hosts/lorebook/schemas';
import { LOREBOOK_TOOL_NAMES } from '../../../../src/agent/hosts/lorebook/tools';

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
  'test_keys',
  'excludeRecursion',
  'update_book_settings',
  'insertion_order',
  'suggest_names',
] as const;

describe('buildLorebookAgentSystemPrompt', () => {
  it('teaches native functions', () => {
    const prompt = buildLorebookAgentSystemPrompt([]);
    expect(prompt).toContain('provided functions');
    expect(prompt).not.toContain('<tool_call>');
    expect(prompt).not.toContain('</tool_call>');
    expect(prompt).not.toContain('Prefer those over XML');
    expect(prompt).not.toContain('- list_entries —');
    for (const name of TOOL_NAMES) {
      expect(prompt).toContain(name);
    }
    expect(prompt).toContain('already in context');
    expect(prompt).not.toContain('Do not update or delete existing entries');
    expect(prompt).not.toContain('Call list_entries before adding');
    expect(prompt).not.toContain('<<<');
    expect(prompt).not.toContain('>>>');
  });
});

describe('lorebook tool spec sync', () => {
  it('has one spec per tool name with no duplicates', () => {
    const specNames = LOREBOOK_TOOL_SPECS.map((spec) => spec.name);
    expect([...LOREBOOK_TOOL_NAMES].sort()).toEqual([...specNames].sort());
    expect(new Set(specNames).size).toBe(specNames.length);
  });
});
