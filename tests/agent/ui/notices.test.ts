import { describe, expect, it } from 'vitest';
import {
  CHARACTER_LOOKUP_TOOLS,
  compactToolResultMessage,
  interruptedRunMessageIds,
  interruptedRunNotice,
  isLookupOnlyTurn,
  messageNotices,
  REVIEW_NOTE_TOOL,
  RUN_INTERRUPTED_TOOL,
  shouldRenderAgentMessage,
  toAgentToolEvent,
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
const interrupted: AgentToolEvent = {
  toolName: RUN_INTERRUPTED_TOOL,
  ok: false,
  message: interruptedRunNotice(true, false),
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

  it('hides the review note', () => {
    const note: AgentToolEvent = {
      toolName: REVIEW_NOTE_TOOL,
      ok: true,
      message: 'The user applied every change from this run.',
    };
    expect(visibleToolEvents([okAdd, note])).toEqual([okAdd]);
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

  it('hides the interrupted-run note', () => {
    expect(visibleToolEvents([okAdd, interrupted])).toEqual([okAdd]);
  });
});

describe('messageNotices', () => {
  it('returns the run error when present', () => {
    expect(messageNotices('Agent request failed')).toEqual(['Agent request failed']);
  });

  it('returns an empty list when there is nothing to report', () => {
    expect(messageNotices(undefined)).toEqual([]);
  });

  it('adds the interrupted-run notice from the message events', () => {
    expect(messageNotices(undefined, [okAdd, interrupted])).toEqual([
      'Interrupted by leaving or refreshing the page. These edits were not saved.',
    ]);
  });
});

describe('interruptedRunNotice', () => {
  it('says nothing changed when the run had no writes', () => {
    expect(interruptedRunNotice(false, false)).toBe(
      'Interrupted by leaving or refreshing the page. Nothing was changed.',
    );
  });

  it('names the waiting review', () => {
    expect(interruptedRunNotice(true, true)).toBe(
      'Interrupted by leaving or refreshing the page before review. These edits were not saved.',
    );
  });
});

describe('interruptedRunMessageIds', () => {
  it('marks every message of the interrupted run and nothing else', () => {
    const history = [
      { id: 'u1', role: 'user' },
      { id: 'a1', role: 'assistant' },
      { id: 'u2', role: 'user' },
      { id: 'a2', role: 'assistant' },
      { id: 'a3', role: 'assistant' },
    ];
    const ids = interruptedRunMessageIds(history, { a1: [okAdd], a2: [okAdd], a3: [interrupted] });
    expect([...ids]).toEqual(['a2', 'a3']);
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
  it('says the writes were not saved for an interrupted run', () => {
    expect(writeRecapLine([okAdd], true)).toBe('Not saved');
    expect(writeRecapLine([], true)).toBeNull();
  });

  it('counts successful writes only', () => {
    expect(writeRecapLine([okAdd])).toBe('Applied 1 write');
    expect(writeRecapLine([okAdd, okUpdate])).toBe('Applied 2 writes');
    expect(writeRecapLine([failed])).toBeNull();
    expect(writeRecapLine([])).toBeNull();
  });
});

describe('toAgentToolEvent', () => {
  const replace = {
    name: 'replace_in_field',
    headers: { id: 'description', old: 'grim', new: 'wry' },
    body: '',
  };

  it('keeps the arguments of a successful write', () => {
    const event = toAgentToolEvent(
      { ok: true, toolName: 'replace_in_field', message: 'ok description (Description) — replaced 1' },
      replace,
      CHARACTER_LOOKUP_TOOLS,
    );
    expect(event).toEqual({
      toolName: 'replace_in_field',
      ok: true,
      message: 'ok description (Description) — replaced 1',
      target: { type: 'field', id: 'description' },
      call: { headers: { id: 'description', old: 'grim', new: 'wry' }, body: '' },
    });
  });

  it('copies the headers so later changes to the action do not leak in', () => {
    const action = { ...replace, headers: { ...replace.headers } };
    const event = toAgentToolEvent(
      { ok: true, toolName: 'replace_in_field', message: 'ok description (Description) — replaced 1' },
      action,
      CHARACTER_LOOKUP_TOOLS,
    );
    action.headers.new = 'changed';
    expect(event.call?.headers.new).toBe('wry');
  });

  it('keeps no arguments for failed writes', () => {
    const event = toAgentToolEvent(
      { ok: false, toolName: 'replace_in_field', message: 'error: old text not found' },
      replace,
      CHARACTER_LOOKUP_TOOLS,
    );
    expect(event.call).toBeUndefined();
    expect(event.target).toBeUndefined();
  });

  it('keeps no arguments or body for lookups', () => {
    const event = toAgentToolEvent(
      { ok: true, toolName: 'read_field', message: 'description (Description)\n---\nSECRET BODY' },
      { name: 'read_field', headers: { id: 'description' }, body: '' },
      CHARACTER_LOOKUP_TOOLS,
    );
    expect(event).toEqual({
      toolName: 'read_field',
      ok: true,
      message: 'description (Description)',
      target: undefined,
    });
  });

  it('works without an action', () => {
    const event = toAgentToolEvent(
      { ok: false, toolName: 'add_entry', message: 'too_many_actions: max 12 per turn' },
      undefined,
      CHARACTER_LOOKUP_TOOLS,
    );
    expect(event.call).toBeUndefined();
  });
});
