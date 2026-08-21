import { describe, expect, it } from 'vitest';
import { buildLorebookAgentSystemPrompt } from '../../../../src/agent/hosts/lorebook/prompt';

describe('buildLorebookAgentSystemPrompt', () => {
  it('teaches XML tool_call and does not mention custom fences', () => {
    const prompt = buildLorebookAgentSystemPrompt([]);
    expect(prompt).toContain('<tool_call>');
    expect(prompt).toContain('</tool_call>');
    expect(prompt).toContain('list_entries');
    expect(prompt).toContain('read_entry');
    expect(prompt).toContain('add_entry');
    expect(prompt).toContain('update_entry');
    expect(prompt).toContain('delete_entry');
    expect(prompt).toContain('already in context');
    expect(prompt).not.toContain('Do not update or delete existing entries');
    expect(prompt).not.toContain('Call list_entries before adding');
    expect(prompt).not.toContain('<<<');
    expect(prompt).not.toContain('>>>');
    expect(prompt).toContain('Never write the word tool_name');
    expect(prompt).not.toContain('never JSON');
    expect(prompt).toContain('native');
  });
});
