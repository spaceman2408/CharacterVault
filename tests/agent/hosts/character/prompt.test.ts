import { describe, expect, it } from 'vitest';
import { buildCharacterAgentSystemPrompt, CHARACTER_TOOL_LIST } from '../../../../src/agent/hosts/character/prompt';
import { CHARACTER_TOOL_SPECS } from '../../../../src/agent/hosts/character/schemas';
import {
  CHARACTER_OVERRIDES_LOREBOOK_TOOLS,
  CHARACTER_TOOL_NAMES,
} from '../../../../src/agent/hosts/character/tools';
import { LOREBOOK_TOOL_SPECS } from '../../../../src/agent/hosts/lorebook/schemas';

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

describe('character tool list/spec sync', () => {
  it('covers the composed spec set with no duplicates', () => {
    const listed = [...CHARACTER_TOOL_LIST.matchAll(/^- (\w+)/gm)].map((match) => match[1]);
    const composedSpecs = [
      ...CHARACTER_TOOL_SPECS,
      ...LOREBOOK_TOOL_SPECS.filter(
        (spec) => !CHARACTER_OVERRIDES_LOREBOOK_TOOLS.has(spec.name),
      ),
    ];
    const composedNames = composedSpecs.map((spec) => spec.name);
    for (const name of composedNames) {
      expect(listed).toContain(name);
    }
    for (const name of listed) {
      expect(composedNames).toContain(name);
    }
    expect(new Set(listed).size).toBe(listed.length);
    expect(new Set(composedNames).size).toBe(composedNames.length);
    expect([...CHARACTER_TOOL_NAMES].sort()).toEqual(
      CHARACTER_TOOL_SPECS.map((spec) => spec.name).sort(),
    );
  });
});
