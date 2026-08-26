import { describe, expect, it } from 'vitest';
import {
  CHARACTER_LOOKUP_TOOLS,
  compactToolResultMessage,
  isLookupOnlyTurn,
  messageNotices,
  shouldRenderAgentMessage,
  visibleToolEvents,
  writeRecapLine,
} from '../../../src/agent/ui/notices';
import type { AgentToolEvent } from '../../../src/agent/ui/types';

const okList: AgentToolEvent = { toolName: 'list_entries', ok: true, message: '24 entries' };
const okRead: AgentToolEvent = {
  toolName: 'read_entry',
  ok: true,
  message: '#4 The Red Keep\nkeys: keep\n---\nSECRET BODY',
};
const okAdd: AgentToolEvent = { toolName: 'add_entry', ok: true, message: 'ok #24 Prime Days' };
const okUpdate: AgentToolEvent = {
  toolName: 'update_entry',
  ok: true,
  message: 'ok #4 The Red Keep',
};
const okAddAgain: AgentToolEvent = {
  toolName: 'add_entry',
  ok: true,
  message: 'ok #24 Prime Days',
};
const failed: AgentToolEvent = {
  toolName: 'incomplete_action',
  ok: false,
  message: 'incomplete_action: a tool_call was not closed with </tool_call>',
};

describe('visibleToolEvents', () => {
  it('hides successful lookups and keeps failed rows', () => {
    expect(visibleToolEvents([okList, okRead, failed, okAdd])).toEqual([failed, okAdd]);
  });

  it('keeps a failed lookup so the error is visible', () => {
    const failedRead: AgentToolEvent = {
      toolName: 'read_entry',
      ok: false,
      message: 'error: no entry #9',
    };
    expect(visibleToolEvents([okList, failedRead])).toEqual([failedRead]);
  });

  it('keeps writes to different ids', () => {
    const okDelete: AgentToolEvent = {
      toolName: 'delete_entry',
      ok: true,
      message: 'ok #5 Elsewhere',
    };
    expect(visibleToolEvents([okAdd, okUpdate, okDelete])).toEqual([okAdd, okUpdate, okDelete]);
  });

  it('keeps the latest write per id', () => {
    const laterUpdate: AgentToolEvent = {
      toolName: 'update_entry',
      ok: true,
      message: 'ok #24 Prime Days',
    };
    expect(visibleToolEvents([okAdd, okAddAgain, laterUpdate])).toEqual([laterUpdate]);
  });

  it('collapses replace_in_entry onto the same id', () => {
    const replaced: AgentToolEvent = {
      toolName: 'replace_in_entry',
      ok: true,
      message: 'ok #24 Prime Days — replaced 1',
    };
    expect(visibleToolEvents([okAdd, replaced])).toEqual([replaced]);
  });

  it('does not hide a failed replace behind an earlier write to the same id', () => {
    const failedReplace: AgentToolEvent = {
      toolName: 'replace_in_entry',
      ok: false,
      message: 'error: old not found (re-read and copy a unique snippet, or rewrite the whole value)',
    };
    expect(visibleToolEvents([okAdd, failedReplace])).toEqual([okAdd, failedReplace]);
  });
});

describe('messageNotices', () => {
  it('returns the run error when present', () => {
    expect(messageNotices('Agent request failed')).toEqual(['Agent request failed']);
  });

  it('returns an empty list when there is nothing to report', () => {
    expect(messageNotices(undefined)).toEqual([]);
  });
});

describe('compactToolResultMessage', () => {
  it('keeps only the list_entries header so the catalog is not stored in chat state', () => {
    expect(compactToolResultMessage('list_entries', '24 entries\n#1 Foo — keys: foo\n#2 Bar')).toBe(
      '24 entries',
    );
  });

  it('leaves write results unchanged', () => {
    expect(compactToolResultMessage('add_entry', 'ok #24 Prime Days')).toBe('ok #24 Prime Days');
  });

  it('keeps only the read_entry header so the body is not stored in chat state', () => {
    expect(compactToolResultMessage('read_entry', okRead.message)).toBe('#4 The Red Keep');
  });
});

describe('isLookupOnlyTurn', () => {
  it('is true when every event is a successful lookup', () => {
    expect(isLookupOnlyTurn([okList])).toBe(true);
    expect(isLookupOnlyTurn([okRead])).toBe(true);
    expect(isLookupOnlyTurn([okList, okRead])).toBe(true);
    expect(isLookupOnlyTurn([okList, okAdd])).toBe(false);
    expect(isLookupOnlyTurn([])).toBe(false);
  });

  it('uses the lookup set so character field reads are silent', () => {
    const okReadField: AgentToolEvent = {
      toolName: 'read_field',
      ok: true,
      message: 'description (Description) — 3 tokens\n---\nSECRET',
    };
    expect(isLookupOnlyTurn([okReadField], CHARACTER_LOOKUP_TOOLS)).toBe(true);
    expect(isLookupOnlyTurn([okList], CHARACTER_LOOKUP_TOOLS)).toBe(true);
    expect(isLookupOnlyTurn([okReadField])).toBe(false);
    const okSearch: AgentToolEvent = {
      toolName: 'search',
      ok: true,
      message: '2 matches in 2 places for "harbor"\ndescription (1): …harbor…',
    };
    expect(isLookupOnlyTurn([okSearch], CHARACTER_LOOKUP_TOOLS)).toBe(true);
    const okAudit: AgentToolEvent = {
      toolName: 'audit_card',
      ok: true,
      message: 'Card audit — 3/14 fields filled, 0 greetings, 0 entries, ~10 active / ~10 total tokens',
    };
    expect(isLookupOnlyTurn([okAudit], CHARACTER_LOOKUP_TOOLS)).toBe(true);
    const okRecursion: AgentToolEvent = {
      toolName: 'read_recursion',
      ok: true,
      message: 'Recursion map — 2 entries, 1 edge, 0 isolated, cycle: none; recursive_scanning on',
    };
    expect(isLookupOnlyTurn([okRecursion], CHARACTER_LOOKUP_TOOLS)).toBe(true);
  });
});

describe('shouldRenderAgentMessage', () => {
  it('skips assistant turns that are only a silent lookup', () => {
    expect(shouldRenderAgentMessage('assistant', '', [], [])).toBe(false);
  });

  it('keeps user turns and assistant turns with speech or writes', () => {
    expect(shouldRenderAgentMessage('user', '', [], [])).toBe(true);
    expect(shouldRenderAgentMessage('assistant', 'Done.', [], [])).toBe(true);
    expect(shouldRenderAgentMessage('assistant', '', [okAdd], [])).toBe(true);
    expect(shouldRenderAgentMessage('assistant', '', [failed], [])).toBe(true);
    expect(shouldRenderAgentMessage('assistant', '', [], [], 'planning the cut')).toBe(true);
  });
});

describe('writeRecapLine', () => {
  it('counts successful writes only', () => {
    expect(writeRecapLine([okAdd])).toBe('Applied 1 write');
    expect(writeRecapLine([okAdd, okUpdate])).toBe('Applied 2 writes');
    expect(writeRecapLine([failed])).toBeNull();
    expect(writeRecapLine([])).toBeNull();
  });
});
