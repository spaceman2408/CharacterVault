import { describe, expect, it } from 'vitest';
import { pruneMessagesToBudget } from '../../../src/agent/core/pruneMessages';
import { parseActions } from '../../../src/agent/core/parseActions';
import {
  contextMeterHistory,
  KEPT_RUN_EMPTY_REPLY,
  keptEditsOptions,
  keptWriteEvents,
  toLoopHistory,
} from '../../../src/agent/ui/loopHistory';
import { estimatePromptTokens } from '../../../src/agent/ui/promptUsage';
import {
  CHARACTER_LOOKUP_TOOLS,
  LOREBOOK_LOOKUP_TOOLS,
  REVIEW_NOTE_TOOL,
  RUN_INTERRUPTED_NOTE,
  RUN_INTERRUPTED_TOOL,
  TURN_LIMIT_NOTICE,
} from '../../../src/agent/ui/notices';
import type { AgentToolEvent } from '../../../src/agent/ui/types';
import type { ChatMessage } from '../../../src/components/ai/types';
import { AIService } from '../../../src/services/AIService';

function message(id: string, role: 'user' | 'assistant', content = ''): ChatMessage {
  return { id, role, content, timestamp: 1 };
}

const updateDescription: AgentToolEvent = {
  toolName: 'update_field',
  ok: true,
  message: 'ok description (Description) — 320 tokens',
};
const addHarbor: AgentToolEvent = { toolName: 'add_entry', ok: true, message: 'ok #4 Harbor' };
const readField: AgentToolEvent = {
  toolName: 'read_field',
  ok: true,
  message: 'description (Description)\n---\nSECRET BODY',
};
const failedReplace: AgentToolEvent = {
  toolName: 'replace_in_field',
  ok: false,
  message: 'error: old text not found',
};

describe('toLoopHistory', () => {
  it('collapses a run into one assistant message that names its edits', () => {
    const history = [
      message('u1', 'user', 'Tighten the description and add a Harbor entry'),
      message('a1', 'assistant'),
      message('a2', 'assistant'),
      message('a3', 'assistant', 'Done. Tightened the description and added Harbor.'),
      message('u2', 'user', 'Thanks'),
    ];
    const events = { a1: [readField, updateDescription], a2: [failedReplace, addHarbor] };
    expect(toLoopHistory(history, events, CHARACTER_LOOKUP_TOOLS)).toEqual([
      { role: 'user', content: 'Tighten the description and add a Harbor entry' },
      {
        role: 'assistant',
        content:
          'Done. Tightened the description and added Harbor.\n\n'
          + '[App note: edits this run: Updated Description (320 tokens); Added “Harbor” (#4)]',
      },
      { role: 'user', content: 'Thanks' },
    ]);
  });

  it('never resends lookup bodies', () => {
    const history = [message('u1', 'user', 'Read it'), message('a1', 'assistant', 'Read.')];
    const [, assistant] = toLoopHistory(history, { a1: [readField] }, CHARACTER_LOOKUP_TOOLS);
    expect(assistant.content).toBe('Read.');
  });

  it('drops runs with no speech and no edits', () => {
    const history = [message('u1', 'user', 'Hi'), message('a1', 'assistant'), message('u2', 'user', 'Hello?')];
    expect(toLoopHistory(history, {}, CHARACTER_LOOKUP_TOOLS)).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'user', content: 'Hello?' },
    ]);
  });

  it('adds the review outcome after the edits', () => {
    const review: AgentToolEvent = {
      toolName: REVIEW_NOTE_TOOL,
      ok: true,
      message: 'Rejected: “Harbor” (#4).',
    };
    const history = [message('u1', 'user', 'Add Harbor'), message('a1', 'assistant', 'Added.')];
    const [, assistant] = toLoopHistory(
      history,
      { a1: [addHarbor, review] },
      CHARACTER_LOOKUP_TOOLS,
    );
    expect(assistant.content).toBe(
      'Added.\n\n'
      + '[App note: edits this run: Added “Harbor” (#4)]\n\n'
      + '[App note: review: Rejected: “Harbor” (#4).]',
    );
  });

  it('notes a run that stopped at the turn limit, even with only lookups', () => {
    const history = [
      message('u1', 'user', 'Search everywhere'),
      message('a1', 'assistant'),
      message('u2', 'user', 'Continue where you left off.'),
    ];
    expect(
      toLoopHistory(history, { a1: [readField] }, CHARACTER_LOOKUP_TOOLS, { a1: TURN_LIMIT_NOTICE }),
    ).toEqual([
      { role: 'user', content: 'Search everywhere' },
      { role: 'assistant', content: `[App note: ${TURN_LIMIT_NOTICE}]` },
      { role: 'user', content: 'Continue where you left off.' },
    ]);
  });

  it('replaces the edits note when the run was interrupted before its writes were saved', () => {
    const interrupted: AgentToolEvent = {
      toolName: RUN_INTERRUPTED_TOOL,
      ok: false,
      message: 'Interrupted by leaving or refreshing the page. These edits were not saved.',
    };
    const history = [
      message('u1', 'user', 'Tighten the description and add Harbor'),
      message('a1', 'assistant'),
      message('a2', 'assistant'),
      message('u2', 'user', 'What did you change?'),
    ];
    expect(
      toLoopHistory(
        history,
        { a1: [updateDescription], a2: [addHarbor, interrupted] },
        CHARACTER_LOOKUP_TOOLS,
      ),
    ).toEqual([
      { role: 'user', content: 'Tighten the description and add Harbor' },
      { role: 'assistant', content: `[App note: ${RUN_INTERRUPTED_NOTE}]` },
      { role: 'user', content: 'What did you change?' },
    ]);
  });

  it('does not resend other error notices', () => {
    const history = [message('u1', 'user', 'Go'), message('a1', 'assistant')];
    expect(
      toLoopHistory(history, {}, CHARACTER_LOOKUP_TOOLS, { a1: 'Provider returned 500' }),
    ).toEqual([{ role: 'user', content: 'Go' }]);
  });

  it('strips tool fences from stored speech', () => {
    const history = [
      message('u1', 'user', 'Go'),
      message('a1', 'assistant', 'Working.\n<<<list_entries\n>>>'),
    ];
    const [, assistant] = toLoopHistory(history, {}, CHARACTER_LOOKUP_TOOLS);
    expect(assistant.content).toBe('Working.');
  });
});

describe('toLoopHistory with keepEdits', () => {
  const keep = { keepEdits: true };
  const replaceTone: AgentToolEvent = {
    toolName: 'replace_in_field',
    ok: true,
    message: 'ok description (Description) — replaced 1',
    target: { type: 'field', id: 'description' },
    call: { headers: { id: 'description', old: 'grim', new: 'wry' }, body: '' },
  };
  const addHarborCall: AgentToolEvent = {
    ...addHarbor,
    call: { headers: { name: 'Harbor', keys: 'harbor, docks' }, body: 'Fog rolls in.\nShips wait.' },
  };
  const reviseHarborCall: AgentToolEvent = {
    toolName: 'update_entry',
    ok: true,
    message: 'ok #4 Harbor',
    call: { headers: { id: '4' }, body: 'Fog rolls in at dusk.' },
  };

  it('replays a run as native tool calls, their results, then the reply', () => {
    const history = [
      message('u1', 'user', 'Soften the tone and add Harbor'),
      message('a1', 'assistant'),
      message('a2', 'assistant', 'Done. Softened it and added Harbor.'),
      message('u2', 'user', 'Change the keys in edit 2'),
    ];
    const events = { a1: [readField, replaceTone], a2: [failedReplace, addHarborCall] };
    expect(toLoopHistory(history, events, CHARACTER_LOOKUP_TOOLS, {}, keep)).toEqual([
      { role: 'user', content: 'Soften the tone and add Harbor' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'k00000001',
            name: 'replace_in_field',
            arguments: JSON.stringify({ id: 'description', old: 'grim', new: 'wry' }),
          },
          {
            id: 'k00000002',
            name: 'add_entry',
            arguments: JSON.stringify({
              name: 'Harbor',
              keys: 'harbor, docks',
              content: 'Fog rolls in.\nShips wait.',
            }),
          },
        ],
      },
      { role: 'tool', tool_call_id: 'k00000001', content: 'ok description (Description) — replaced 1' },
      { role: 'tool', tool_call_id: 'k00000002', content: 'ok #4 Harbor' },
      { role: 'assistant', content: 'Done. Softened it and added Harbor.' },
      { role: 'user', content: 'Change the keys in edit 2' },
    ]);
  });

  it('replays a run as XML calls the parser reads back to the same arguments', () => {
    const history = [message('u1', 'user', 'Go'), message('a1', 'assistant', 'Done.')];
    const replay = toLoopHistory(
      history,
      { a1: [replaceTone, addHarborCall] },
      CHARACTER_LOOKUP_TOOLS,
      {},
      { keepEdits: true, toolMode: 'xml' },
    );
    expect(replay.map((row) => row.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(replay[1].tool_calls).toBeUndefined();
    expect(parseActions(replay[1].content ?? '').actions).toEqual([
      { name: 'replace_in_field', headers: { id: 'description', old: 'grim', new: 'wry' }, body: '' },
      { name: 'add_entry', headers: { name: 'Harbor', keys: 'harbor, docks' }, body: 'Fog rolls in.\nShips wait.' },
    ]);
    expect(replay[2].content).toBe(
      'Tool results:\n[replace_in_field] ok description (Description) — replaced 1\n[add_entry] ok #4 Harbor',
    );
    expect(replay[3].content).toBe('Done.');
  });

  it('folds newlines in XML header values, which replace matching folds too', () => {
    const multiline: AgentToolEvent = {
      ...replaceTone,
      call: { headers: { id: 'description', old: 'grim\nand cold', new: 'wry' }, body: '' },
    };
    const history = [message('u1', 'user', 'Go'), message('a1', 'assistant', 'Done.')];
    const [, calls] = toLoopHistory(
      history,
      { a1: [multiline] },
      CHARACTER_LOOKUP_TOOLS,
      {},
      { keepEdits: true, toolMode: 'xml' },
    );
    expect(parseActions(calls.content ?? '').actions[0].headers.old).toBe('grim and cold');
  });

  it('puts the review and turn-limit notes on the last result, never in the reply', () => {
    const review: AgentToolEvent = {
      toolName: REVIEW_NOTE_TOOL,
      ok: true,
      message: 'The user discarded every change from this run.',
    };
    const history = [message('u1', 'user', 'Go'), message('a1', 'assistant', 'Done.')];
    const replay = toLoopHistory(
      history,
      { a1: [replaceTone, addHarborCall, review] },
      CHARACTER_LOOKUP_TOOLS,
      { a1: TURN_LIMIT_NOTICE },
      keep,
    );
    expect(replay[2].content).toBe('ok description (Description) — replaced 1');
    expect(replay[3].content).toBe(
      'ok #4 Harbor\n'
      + '[App note: review: The user discarded every change from this run.]\n'
      + `[App note: ${TURN_LIMIT_NOTICE}]`,
    );
    expect(replay[4]).toEqual({ role: 'assistant', content: 'Done.' });
  });

  it('ends a run that had no speech with a stand-in reply', () => {
    const history = [message('u1', 'user', 'Go'), message('a1', 'assistant'), message('u2', 'user', 'Next')];
    const replay = toLoopHistory(history, { a1: [replaceTone] }, CHARACTER_LOOKUP_TOOLS, {}, keep);
    expect(replay.map((row) => row.role)).toEqual(['user', 'assistant', 'tool', 'assistant', 'user']);
    expect(replay[3].content).toBe(KEPT_RUN_EMPTY_REPLY);
  });

  it('gives every replayed call a unique 9-character alphanumeric id across runs', () => {
    const history = [
      message('u1', 'user', 'Soften the tone'),
      message('a1', 'assistant', 'Softened.'),
      message('u2', 'user', 'Add Harbor'),
      message('a2', 'assistant', 'Added.'),
    ];
    const replay = toLoopHistory(
      history,
      { a1: [replaceTone], a2: [addHarborCall, reviseHarborCall] },
      LOREBOOK_LOOKUP_TOOLS,
      {},
      keep,
    );
    const ids = replay.flatMap((row) => row.tool_calls?.map((call) => call.id) ?? []);
    expect(ids).toEqual(['k00000001', 'k00000002', 'k00000003']);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{9}$/);
  });

  it('replays an add and its later revision as two calls instead of merging them', () => {
    const history = [message('u1', 'user', 'Add Harbor'), message('a1', 'assistant', 'Added.')];
    const [, calls] = toLoopHistory(
      history,
      { a1: [addHarborCall, reviseHarborCall] },
      LOREBOOK_LOOKUP_TOOLS,
      {},
      keep,
    );
    expect(calls.tool_calls?.map((call) => call.name)).toEqual(['add_entry', 'update_entry']);
  });

  it('never replays lookups or failed writes', () => {
    const lookupWithCall: AgentToolEvent = {
      ...readField,
      call: { headers: { id: 'description' }, body: '' },
    };
    const failedWithCall: AgentToolEvent = {
      ...failedReplace,
      call: { headers: { id: 'description', old: 'missing', new: 'x' }, body: '' },
    };
    const history = [message('u1', 'user', 'Go'), message('a1', 'assistant', 'Done.')];
    expect(
      toLoopHistory(history, { a1: [lookupWithCall, failedWithCall] }, CHARACTER_LOOKUP_TOOLS, {}, keep),
    ).toEqual([
      { role: 'user', content: 'Go' },
      { role: 'assistant', content: 'Done.' },
    ]);
  });

  it('falls back to the summary note when a write was saved before arguments were kept', () => {
    const history = [message('u1', 'user', 'Tighten it'), message('a1', 'assistant', 'Tightened.')];
    expect(
      toLoopHistory(history, { a1: [updateDescription, replaceTone] }, CHARACTER_LOOKUP_TOOLS, {}, keep),
    ).toEqual([
      { role: 'user', content: 'Tighten it' },
      {
        role: 'assistant',
        content:
          'Tightened.\n\n[App note: edits this run: Updated Description (320 tokens); Replaced 1 in Description]',
      },
    ]);
  });

  it('falls back to the summary note when the replay would pass the token cap', () => {
    const history = [message('u1', 'user', 'Go'), message('a1', 'assistant', 'Done.')];
    const big: AgentToolEvent = {
      ...addHarborCall,
      call: { headers: { name: 'Harbor' }, body: 'lore '.repeat(4000) },
    };
    const replay = toLoopHistory(
      history,
      { a1: [big] },
      LOREBOOK_LOOKUP_TOOLS,
      {},
      { keepEdits: true, maxKeptRunTokens: 500 },
    );
    expect(replay).toEqual([
      { role: 'user', content: 'Go' },
      { role: 'assistant', content: 'Done.\n\n[App note: edits this run: Added “Harbor” (#4)]' },
    ]);
  });

  it('still sends only the interrupted note when the run never saved', () => {
    const interrupted: AgentToolEvent = {
      toolName: RUN_INTERRUPTED_TOOL,
      ok: false,
      message: 'Interrupted.',
    };
    const history = [message('u1', 'user', 'Go'), message('a1', 'assistant')];
    const [, assistant] = toLoopHistory(
      history,
      { a1: [replaceTone, interrupted] },
      CHARACTER_LOOKUP_TOOLS,
      {},
      keep,
    );
    expect(assistant).toEqual({ role: 'assistant', content: `[App note: ${RUN_INTERRUPTED_NOTE}]` });
  });

  it('ignores stored arguments when the option is off', () => {
    const history = [message('u1', 'user', 'Go'), message('a1', 'assistant', 'Done.')];
    const [, assistant] = toLoopHistory(history, { a1: [replaceTone] }, CHARACTER_LOOKUP_TOOLS);
    expect(assistant).toEqual({
      role: 'assistant',
      content: 'Done.\n\n[App note: edits this run: Replaced 1 in Description]',
    });
  });

  it('survives budget pruning without orphaning a tool result', () => {
    const history: ChatMessage[] = [];
    const events: Record<string, AgentToolEvent[]> = {};
    for (let run = 0; run < 6; run += 1) {
      history.push(message(`u${run}`, 'user', `Run ${run}`), message(`a${run}`, 'assistant', `Did ${run}.`));
      events[`a${run}`] = [
        { ...addHarborCall, call: { headers: { name: `Place ${run}` }, body: 'lore '.repeat(200) } },
        reviseHarborCall,
      ];
    }
    const prompt = [
      { role: 'system' as const, content: 'sys' },
      ...toLoopHistory(history, events, LOREBOOK_LOOKUP_TOOLS, {}, keep),
      { role: 'user' as const, content: 'Now' },
    ];
    const pruned = pruneMessagesToBudget(prompt, 1500, estimatePromptTokens);
    expect(pruned.length).toBeLessThan(prompt.length);
    const seen = new Set<string>();
    for (const row of pruned) {
      for (const call of row.tool_calls ?? []) seen.add(call.id);
      if (row.role === 'tool') expect(seen.has(row.tool_call_id ?? '')).toBe(true);
    }
  });

  it('caps one replayed run at a quarter of the input budget', () => {
    const sampler = { contextLength: 16384, maxTokens: 2048 };
    const options = keptEditsOptions(true, 'xml', sampler);
    expect(options.keepEdits).toBe(true);
    expect(options.toolMode).toBe('xml');
    expect(options.maxKeptRunTokens).toBe(Math.floor(AIService.inputTokenBudget(sampler) * 0.25));
  });

  it('picks out successful writes only', () => {
    const review: AgentToolEvent = { toolName: REVIEW_NOTE_TOOL, ok: true, message: 'Approved.' };
    expect(
      keptWriteEvents(
        [readField, replaceTone, failedReplace, review, addHarborCall],
        CHARACTER_LOOKUP_TOOLS,
      ),
    ).toEqual([replaceTone, addHarborCall]);
  });
});

describe('contextMeterHistory', () => {
  const replaceTone: AgentToolEvent = {
    toolName: 'replace_in_field',
    ok: true,
    message: 'ok description (Description) — replaced 1',
    call: { headers: { id: 'description', old: 'grim', new: 'wry' }, body: '' },
  };
  const history = [message('u1', 'user', 'Soften it'), message('a1', 'assistant', 'Softened.')];

  it('counts the raw transcript when the option is off', () => {
    expect(
      contextMeterHistory(history, { a1: [replaceTone] }, CHARACTER_LOOKUP_TOOLS, {}, { keepEdits: false }),
    ).toBe(history);
  });

  it('counts replayed call arguments when the option is on', () => {
    const rows = contextMeterHistory(
      history,
      { a1: [replaceTone] },
      CHARACTER_LOOKUP_TOOLS,
      {},
      { keepEdits: true },
    );
    expect(rows.map((row) => row.content).join('\n')).toContain('\\"old\\":\\"grim\\"');
  });
});
