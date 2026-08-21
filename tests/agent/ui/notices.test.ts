import { describe, expect, it } from 'vitest';
import {
  compactToolResultMessage,
  isLookupOnlyTurn,
  messageNotices,
  shouldRenderAgentMessage,
  visibleToolEvents,
} from '../../../src/agent/ui/notices';
import type { AgentToolEvent } from '../../../src/agent/ui/types';

const okList: AgentToolEvent = { toolName: 'list_entries', ok: true, message: '24 entries' };
const okAdd: AgentToolEvent = { toolName: 'add_entry', ok: true, message: 'ok #24 Prime Days' };
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
  it('hides list_entries and failed rows', () => {
    expect(visibleToolEvents([okList, failed, okAdd])).toEqual([okAdd]);
  });

  it('keeps one add_entry row per id', () => {
    expect(visibleToolEvents([okAdd, okAddAgain])).toEqual([okAddAgain]);
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
});

describe('isLookupOnlyTurn', () => {
  it('is true when every event is a successful list_entries', () => {
    expect(isLookupOnlyTurn([okList])).toBe(true);
    expect(isLookupOnlyTurn([okList, okAdd])).toBe(false);
    expect(isLookupOnlyTurn([])).toBe(false);
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
