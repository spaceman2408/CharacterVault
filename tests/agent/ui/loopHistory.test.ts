import { describe, expect, it } from 'vitest';
import { toLoopHistory } from '../../../src/agent/ui/loopHistory';
import {
  CHARACTER_LOOKUP_TOOLS,
  REVIEW_NOTE_TOOL,
  RUN_INTERRUPTED_NOTE,
  RUN_INTERRUPTED_TOOL,
  TURN_LIMIT_NOTICE,
} from '../../../src/agent/ui/notices';
import type { AgentToolEvent } from '../../../src/agent/ui/types';
import type { ChatMessage } from '../../../src/components/ai/types';

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
