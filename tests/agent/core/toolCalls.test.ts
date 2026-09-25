import { describe, expect, it } from 'vitest';
import { mapNativeToolCalls, parsedActionFromToolCall, repairJson } from '../../../src/agent/core/toolCalls';

describe('repairJson', () => {
  it('returns valid JSON unchanged', () => {
    expect(repairJson('{"name":"Harbor"}')).toBe('{"name":"Harbor"}');
  });

  it('closes a truncated object and string', () => {
    const repaired = repairJson('{"name":"Harbor","keys":["harbor"],"content":"A busy');
    expect(repaired).not.toBeNull();
    expect(JSON.parse(repaired!)).toEqual({
      name: 'Harbor',
      keys: ['harbor'],
      content: 'A busy',
    });
  });

  it('returns null for empty input', () => {
    expect(repairJson('')).toBeNull();
    expect(repairJson('   ')).toBeNull();
  });
});

describe('parsedActionFromToolCall', () => {
  it('maps content and keys array onto ParsedAction', () => {
    const action = parsedActionFromToolCall({
      id: 'call_1',
      name: 'add_entry',
      arguments: JSON.stringify({
        name: 'Harbor',
        keys: ['harbor', 'port'],
        constant: false,
        content: 'A busy harbor.',
      }),
    });
    expect(action).toEqual({
      name: 'add_entry',
      headers: { name: 'Harbor', keys: 'harbor, port', constant: 'false' },
      body: 'A busy harbor.',
    });
  });

  it('treats a truncated string as incomplete instead of salvaging it', () => {
    const action = parsedActionFromToolCall({
      id: 'call_1',
      name: 'add_entry',
      arguments: '{"name":"Harbor","keys":"harbor","content":"A busy harbor.',
    });
    expect(action).toBeNull();
  });

  it('still maps arguments missing only a closing brace', () => {
    const action = parsedActionFromToolCall({
      id: 'call_1',
      name: 'add_entry',
      arguments: '{"name":"Harbor","keys":"harbor","content":"A busy harbor."',
    });
    expect(action?.headers.name).toBe('Harbor');
    expect(action?.body).toBe('A busy harbor.');
  });
});

describe('parsedActionFromToolCall tool names', () => {
  it('rejects an invalid native tool name as incomplete', () => {
    const action = parsedActionFromToolCall({
      id: 'call_1',
      name: 'a(',
      arguments: '{"content":"hi"}',
    });
    expect(action).toBeNull();
  });

  it('still maps a valid but unknown tool name', () => {
    const action = parsedActionFromToolCall({
      id: 'call_1',
      name: 'frobnicate',
      arguments: '{"content":"hi"}',
    });
    expect(action?.name).toBe('frobnicate');
  });
});
describe('mapNativeToolCalls', () => {
  it('stops at the first unrepairable call and keeps earlier actions', () => {
    const mapped = mapNativeToolCalls([
      {
        id: 'a',
        name: 'add_entry',
        arguments: '{"name":"Keep","keys":"keep","content":"Castle"}',
      },
      { id: 'b', name: 'add_entry', arguments: '{not-json' },
    ]);
    expect(mapped.actions).toHaveLength(1);
    expect(mapped.ids).toEqual(['a']);
    expect(mapped.incomplete?.id).toBe('b');
  });
});
