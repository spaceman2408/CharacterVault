import { describe, expect, it } from 'vitest';
import {
  applyToolCallDeltas,
  finalizeToolCalls,
  normalizeMessageToolCalls,
  type NativeToolCall,
} from '../../src/services/toolCallStream';

describe('toolCallStream', () => {
  it('accumulates streamed argument fragments by index', () => {
    const acc: NativeToolCall[] = [];
    applyToolCallDeltas(acc, [{ index: 0, id: 'call_1', function: { name: 'add_entry', arguments: '{"name":' } }]);
    applyToolCallDeltas(acc, [{ index: 0, function: { arguments: '"Harbor"}' } }]);
    expect(finalizeToolCalls(acc)).toEqual([
      { id: 'call_1', name: 'add_entry', arguments: '{"name":"Harbor"}' },
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
