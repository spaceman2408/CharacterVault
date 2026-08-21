import { describe, expect, it } from 'vitest';
import {
  CHARACTER_LOOKUP_TOOLS,
  compactToolResultMessage,
  isLookupOnlyTurn,
  messageNotices,
  shouldRenderAgentMessage,
  visibleToolEvents,
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
  it('hides lookup rows and failed rows', () => {
    expect(visibleToolEvents([okList, okRead, failed, okAdd])).toEqual([okAdd]);
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
});

describe('messageNotices', () => {
  it('collects the run error and failed tool messages', () => {
    expect(messageNotices('Agent request failed', [okList, failed])).toEqual([
      'Agent request failed',
      failed.message,
    ]);
  });

  it('returns an empty list when there is nothing to report', () => {
    expect(messageNotices(undefined, [okList])).toEqual([]);
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
      message: 'description (Description) — 12 chars\n---\nSECRET',
    };
    expect(isLookupOnlyTurn([okReadField], CHARACTER_LOOKUP_TOOLS)).toBe(true);
    expect(isLookupOnlyTurn([okList], CHARACTER_LOOKUP_TOOLS)).toBe(true);
    expect(isLookupOnlyTurn([okReadField])).toBe(false);
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
  });
});
