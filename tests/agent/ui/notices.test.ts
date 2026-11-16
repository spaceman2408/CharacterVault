import { describe, expect, it } from 'vitest';
import {
  CHARACTER_LOOKUP_TOOLS,
  compactToolResultMessage,
  foldToolRows,
  interruptedRunMessageIds,
  interruptedRunNotice,
  messageNotices,
  REVIEW_NOTE_TOOL,
  RUN_INTERRUPTED_TOOL,
  shouldRenderAgentMessage,
  shownToolEvents,
  silentTurnBlocks,
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

describe('foldToolRows', () => {
  it('shows identical rows once with a count, in order of first appearance', () => {
    const replaced: AgentToolEvent = {
      toolName: 'replace_in_field',
      ok: true,
      message: 'ok mes_example (Examples) — replaced 1',
      target: { type: 'field', id: 'mes_example' },
    };
    const read: AgentToolEvent = {
      toolName: 'read_field',
      ok: true,
      message: 'mes_example (Examples) — 40 tokens',
      target: { type: 'field', id: 'mes_example' },
    };
    const rows = foldToolRows([read, replaced, { ...read, message: 'mes_example (Examples) — 41 tokens' }, replaced, okAdd]);
    expect(rows.map((row) => [row.event.toolName, row.count])).toEqual([
      ['read_field', 2],
      ['replace_in_field', 2],
      ['add_entry', 1],
    ]);
  });

  it('keeps rows with different text or links apart', () => {
    const rows = foldToolRows([okUpdate, { ...okUpdate, message: 'ok #5 Harbor' }, failed, failed]);
    expect(rows.map((row) => row.count)).toEqual([1, 1, 2]);
  });
});

describe('silentTurnBlocks', () => {
  const turn = (id: string, content = '', role = 'assistant', reasoning?: string) => ({ id, role, content, reasoning });

  it('groups back-to-back tool-only turns onto the first one', () => {
    const history = [turn('u', 'Fix it', 'user'), turn('a'), turn('b'), turn('c'), turn('d', 'Done.')];
    const blocks = silentTurnBlocks(history, {}, {}, true);
    expect(blocks.get('a')).toEqual({ ids: ['a', 'b', 'c'], lastIndex: 3 });
    expect(blocks.get('b')).toBeNull();
    expect(blocks.get('c')).toBeNull();
    expect(blocks.has('d')).toBe(false);
    expect(blocks.has('u')).toBe(false);
  });

  it('keeps turns with shown thinking apart, and groups them when thinking is hidden', () => {
    const history = [turn('a', '', 'assistant', 'hmm'), turn('b'), turn('c')];
    expect(silentTurnBlocks(history, {}, {}, true).get('b')).toEqual({ ids: ['b', 'c'], lastIndex: 2 });
    expect(silentTurnBlocks(history, {}, {}, false).get('a')).toEqual({ ids: ['a', 'b', 'c'], lastIndex: 2 });
  });

  it('closes a block on a turn with a notice and never crosses a user message', () => {
    const history = [turn('a'), turn('b'), turn('c'), turn('u', 'Continue', 'user'), turn('d'), turn('e')];
    const blocks = silentTurnBlocks(history, {}, { b: 'Stopped' }, true);
    expect(blocks.get('a')).toEqual({ ids: ['a', 'b'], lastIndex: 1 });
    expect(blocks.has('c')).toBe(false);
    expect(blocks.get('d')).toEqual({ ids: ['d', 'e'], lastIndex: 5 });
  });
});

describe('shownToolEvents', () => {
  it('keeps lookups in order with the writes and failed rows', () => {
    expect(shownToolEvents([okList, okRead, failed, okAdd])).toEqual([okList, okRead, failed, okAdd]);
  });

  it('uses the lookup set for character field reads, and still folds repeat entry writes', () => {
    const okReadField: AgentToolEvent = { toolName: 'read_field', ok: true, message: 'description (Description) — 3 tokens' };
    expect(shownToolEvents([okReadField, okAdd, okAddAgain], CHARACTER_LOOKUP_TOOLS)).toEqual([okReadField, okAddAgain]);
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

  it('leaves out writes that changed nothing', () => {
    const noChange: AgentToolEvent = {
      toolName: 'update_entry',
      ok: true,
      message: 'ok #4 The Red Keep — no change, already excludeRecursion: true',
    };
    const settingsNoChange: AgentToolEvent = {
      toolName: 'update_book_settings',
      ok: true,
      message: 'ok Book settings: recursive_scanning: on — no change',
    };
    expect(writeRecapLine([noChange, settingsNoChange])).toBeNull();
    expect(writeRecapLine([okAdd, noChange])).toBe('Applied 1 write');
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
      target: { type: 'field', id: 'description' },
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

describe('read_skill rows', () => {
  const read = (name: string, ok = true): AgentToolEvent =>
    toAgentToolEvent(
      { ok, toolName: 'read_skill', message: ok ? `Skill: ${name}

Follow these steps.` : `error: no skill named "${name}"` },
      { name: 'read_skill', headers: { name }, body: '' },
      CHARACTER_LOOKUP_TOOLS,
    );

  it('keeps only the skill header and shows it without counting it as a write', () => {
    const events = [read('Greeting Writer')];
    expect(events[0].message).toBe('Skill: Greeting Writer');
    expect(events[0].call).toBeUndefined();
    expect(shownToolEvents(events, CHARACTER_LOOKUP_TOOLS)).toEqual(events);
    expect(writeRecapLine(visibleToolEvents(events, CHARACTER_LOOKUP_TOOLS))).toBeNull();
  });

  it('keeps a failed read as an error row', () => {
    const failed = read('Nope', false);
    expect(visibleToolEvents([failed], CHARACTER_LOOKUP_TOOLS)).toEqual([failed]);
  });
});
