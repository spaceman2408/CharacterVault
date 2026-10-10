import { describe, expect, it } from 'vitest';
import { parseActions } from '../../../src/agent/core/parseActions';
import { stripAppNotes, stripFences } from '../../../src/agent/core/stripFences';
import type { AgentMessage } from '../../../src/agent/core/types';
import {
  formatToolResults,
  hasNativeToolTurns,
  nativeToXmlMessages,
  renderXmlCall,
} from '../../../src/agent/core/xmlHistory';

describe('renderXmlCall', () => {
  it('writes headers and a body the parser reads back', () => {
    const action = { name: 'add_entry', headers: { name: 'Harbor', keys: 'harbor, port' }, body: 'A busy harbor.\nShips.' };
    const xml = renderXmlCall(action);
    expect(xml).toBe('<tool_call>\nadd_entry\nname: Harbor\nkeys: harbor, port\n---\nA busy harbor.\nShips.\n</tool_call>');
    expect(parseActions(xml).actions).toEqual([action]);
  });

  it('writes a call with no arguments as just the name', () => {
    expect(renderXmlCall({ name: 'list_entries', headers: {}, body: '' })).toBe(
      '<tool_call>\nlist_entries\n</tool_call>',
    );
  });
});

describe('nativeToXmlMessages', () => {
  const nativeTurn: AgentMessage[] = [
    { role: 'user', content: 'Add Harbor' },
    {
      role: 'assistant',
      content: '',
      tool_calls: [
        { id: 'k00000001', name: 'add_entry', arguments: '{"name":"Harbor","content":"Fog."}' },
        { id: 'k00000002', name: 'update_entry', arguments: '{"id":4,"content":"Fog at dusk."}' },
      ],
    },
    { role: 'tool', tool_call_id: 'k00000001', content: 'ok #4 Harbor' },
    { role: 'tool', tool_call_id: 'k00000002', content: 'ok #4 Harbor\n[App note: review: Approved.]' },
    { role: 'assistant', content: 'Done.' },
    { role: 'user', content: 'Next' },
  ];

  it('rewrites native calls as XML text and their results as one result blob', () => {
    const xml = nativeToXmlMessages(nativeTurn);
    expect(xml.map((row) => row.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user']);
    expect(hasNativeToolTurns(xml)).toBe(false);
    expect(parseActions(xml[1].content ?? '').actions).toEqual([
      { name: 'add_entry', headers: { name: 'Harbor' }, body: 'Fog.' },
      { name: 'update_entry', headers: { id: '4' }, body: 'Fog at dusk.' },
    ]);
    expect(xml[2].content).toBe(
      formatToolResults([
        { toolName: 'add_entry', message: 'ok #4 Harbor' },
        { toolName: 'update_entry', message: 'ok #4 Harbor\n[App note: review: Approved.]' },
      ]),
    );
    expect(xml[3]).toEqual({ role: 'assistant', content: 'Done.' });
  });

  it('keeps speech that came with the calls', () => {
    const xml = nativeToXmlMessages([
      { role: 'assistant', content: 'On it.', tool_calls: [{ id: 'a', name: 'list_entries', arguments: '' }] },
      { role: 'tool', tool_call_id: 'a', content: '3 entries' },
    ]);
    expect(xml[0].content).toBe('On it.\n\n<tool_call>\nlist_entries\n</tool_call>');
    expect(xml[1].content).toBe('Tool results:\n[list_entries] 3 entries');
  });

  it('leaves history without native turns alone', () => {
    const plain: AgentMessage[] = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello.' },
    ];
    expect(hasNativeToolTurns(plain)).toBe(false);
    expect(nativeToXmlMessages(plain)).toEqual(plain);
  });
});

describe('stripAppNotes', () => {
  it('removes a copied kept-edits note from a reply', () => {
    const reply = [
      'Fixed — took all 4 em dashes out of the bar greeting.',
      '',
      '[App note: edits this run, as you sent them (the text may have changed since; read before editing it again):',
      '1. replace_in_greeting {"index":5,"new":", ","old":" — ","replace_all":true}]',
    ].join('\n');
    expect(stripFences(reply)).toBe('Fixed — took all 4 em dashes out of the bar greeting.');
  });

  it('removes one-line notes and keeps the speech around them', () => {
    const reply = 'Added it.\n[App note: review: Approved.]\nAnything else?';
    expect(stripFences(reply)).toBe('Added it.\n\nAnything else?');
  });

  it('leaves text that only mentions a note mid-line', () => {
    const reply = 'The app adds an [App note: …] line, which I will not copy.';
    expect(stripAppNotes(reply)).toBe(reply);
  });
});
