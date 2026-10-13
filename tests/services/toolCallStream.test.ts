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

  it('starts a new call for an index-less delta with a new id', () => {
    const acc: AccumulatingToolCall[] = [];
    applyToolCallDeltas(acc, [{ id: 'a', function: { name: 'read_entry', arguments: '{"id":0}' } }]);
    applyToolCallDeltas(acc, [{ id: 'b', function: { name: 'read_entry', arguments: '{"id":1}' } }]);
    expect(finalizeToolCalls(acc)).toEqual([
      { id: 'a', name: 'read_entry', arguments: '{"id":0}' },
      { id: 'b', name: 'read_entry', arguments: '{"id":1}' },
    ]);
  });

  it('starts a new call for an index-less delta that names a tool when the last call has a name', () => {
    const acc: AccumulatingToolCall[] = [];
    applyToolCallDeltas(acc, [{ function: { name: 'list_entries', arguments: '{}' } }]);
    applyToolCallDeltas(acc, [{ function: { name: 'read_entry' } }]);
    applyToolCallDeltas(acc, [{ function: { arguments: '{"id":2}' } }]);
    expect(finalizeToolCalls(acc)).toEqual([
      { id: 'call_0', name: 'list_entries', arguments: '{}' },
      { id: 'call_1', name: 'read_entry', arguments: '{"id":2}' },
    ]);
  });

  it('keeps index-less argument pieces and repeated ids on the same call', () => {
    const acc: AccumulatingToolCall[] = [];
    applyToolCallDeltas(acc, [{ id: 'a', function: { name: 'add_entry' } }]);
    applyToolCallDeltas(acc, [{ function: { arguments: '{"name":' } }]);
    applyToolCallDeltas(acc, [{ id: 'a', function: { arguments: '"Harbor"}' } }]);
    expect(finalizeToolCalls(acc)).toEqual([
      { id: 'a', name: 'add_entry', arguments: '{"name":"Harbor"}' },
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
