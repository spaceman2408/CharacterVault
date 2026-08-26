import { describe, expect, it } from 'vitest';
import {
  applyToolCallDeltas,
  finalizeToolCalls,
  normalizeMessageToolCalls,
  type AccumulatingToolCall,
} from '../../src/services/toolCallStream';

describe('toolCallStream', () => {
  it('accumulates streamed argument fragments by index', () => {
    const acc: AccumulatingToolCall[] = [];
    applyToolCallDeltas(acc, [{ index: 0, id: 'call_1', function: { name: 'add_entry', arguments: '{"name":' } }]);
    applyToolCallDeltas(acc, [{ index: 0, function: { arguments: '"Harbor"}' } }]);
    expect(finalizeToolCalls(acc)).toEqual([
      { id: 'call_1', name: 'add_entry', arguments: '{"name":"Harbor"}' },
    ]);
  });

  it('joins many tiny argument deltas without dropping content', () => {
    const acc: AccumulatingToolCall[] = [];
    const json = `{"body":"${'x'.repeat(200)}"}`;
    applyToolCallDeltas(acc, [{ index: 0, id: 'call_2', function: { name: 'update_entry' } }]);
    for (const ch of json) {
      applyToolCallDeltas(acc, [{ index: 0, function: { arguments: ch } }]);
    }
    expect(finalizeToolCalls(acc)).toEqual([
      { id: 'call_2', name: 'update_entry', arguments: json },
    ]);
  });

  it('normalizes a non-stream message tool_calls array', () => {
    expect(
      normalizeMessageToolCalls([
        {
          id: 'c1',
          type: 'function',
          function: { name: 'list_entries', arguments: '{}' },
        },
      ]),
    ).toEqual([{ id: 'c1', name: 'list_entries', arguments: '{}' }]);
  });
});
