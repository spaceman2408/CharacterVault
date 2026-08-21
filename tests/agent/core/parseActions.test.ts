import { describe, expect, it } from 'vitest';
import { parseActions } from '../../../src/agent/core/parseActions';
import { stripFences } from '../../../src/agent/core/stripFences';

const ADD_ENTRY = `I'll add the capital.

<<<add_entry
name: The Red Keep
keys: Red Keep, King's Landing, Keep
constant: false
---
The Red Keep is the royal castle in King's Landing.
>>>
`;

describe('parseActions', () => {
  it('parses a single add_entry with name, keys, and body', () => {
    const result = parseActions(ADD_ENTRY);
    expect(result.incomplete).toBe(false);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toEqual({
      name: 'add_entry',
      headers: {
        name: 'The Red Keep',
        keys: "Red Keep, King's Landing, Keep",
        constant: 'false',
      },
      body: 'The Red Keep is the royal castle in King\'s Landing.',
    });
    expect(result.speech).toContain("I'll add the capital.");
  });

  it('parses constant: true and omitted constant', () => {
    const withTrue = parseActions(`<<<add_entry
name: Always
constant: true
---
Always on.
>>>`);
    expect(withTrue.actions[0].headers.constant).toBe('true');

    const omitted = parseActions(`<<<add_entry
name: Sometimes
keys: x
---
Body
>>>`);
    expect(omitted.actions[0].headers.constant).toBeUndefined();
  });

  it('parses a one-line list_entries fence', () => {
    const result = parseActions('Please list.\n<<<list_entries>>>');
    expect(result.actions).toEqual([{ name: 'list_entries', headers: {}, body: '' }]);
    expect(result.speech).toContain('Please list.');
  });

  it('parses two fences in one string', () => {
    const result = parseActions(`<<<list_entries>>>
<<<add_entry
name: Foo
keys: foo
---
Foo body
>>>`);
    expect(result.actions.map((action) => action.name)).toEqual(['list_entries', 'add_entry']);
    expect(result.actions[1].body).toBe('Foo body');
  });

  it('preserves prose before and after fences as speech', () => {
    const result = parseActions('Before.\n<<<list_entries>>>\nAfter.');
    expect(result.speech).toBe('Before.\n\nAfter.');
  });

  it('marks an incomplete fence and does not emit an action', () => {
    const result = parseActions(`<<<add_entry
name: Foo
keys: foo
---
unterminated`);
    expect(result.incomplete).toBe(true);
    expect(result.actions).toEqual([]);
    expect(result.segments.some((segment) => segment.kind === 'incomplete')).toBe(true);
  });

  it('keeps --- inside the body; only a >>> line terminates', () => {
    const result = parseActions(`<<<add_entry
name: Split
keys: split
---
Section A
---
Section B
>>>`);
    expect(result.actions[0].body).toBe('Section A\n---\nSection B');
  });

  it('does not treat >>> inside a body line as a terminator', () => {
    const result = parseActions(`<<<add_entry
name: Code
keys: code
---
Use >>> in examples carefully
>>>`);
    expect(result.actions[0].body).toBe('Use >>> in examples carefully');
  });

  it('preserves the raw keys header for the host to split', () => {
    const result = parseActions(`<<<add_entry
name: Keys
keys: a, b,, c
---
Body
>>>`);
    expect(result.actions[0].headers.keys).toBe('a, b,, c');
  });

  it('ignores JSON blobs and markdown fences that are not this protocol', () => {
    const raw = [
      'Here is JSON:',
      '{"name":"Nope","keys":["x"],"content":"nope"}',
      '',
      '```json',
      '{"tool":"add_entry"}',
      '```',
    ].join('\n');
    const result = parseActions(raw);
    expect(result.actions).toEqual([]);
    expect(result.incomplete).toBe(false);
    expect(result.speech).toBe(raw);
  });

  it('still finds fences when think tags wrap surrounding prose', () => {
    const result = parseActions(`<think>planning</think>
<<<list_entries>>>`);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].name).toBe('list_entries');
  });

  it('parses <tool_call> list_entries </tool_call>', () => {
    const result = parseActions('Checking the book.\n<tool_call> list_entries </tool_call>');
    expect(result.incomplete).toBe(false);
    expect(result.actions).toEqual([{ name: 'list_entries', headers: {}, body: '' }]);
    expect(result.speech).toContain('Checking the book.');
  });

  it('parses a one-line <tool_call>list_entries</tool_call>', () => {
    const result = parseActions('<tool_call>list_entries</tool_call>');
    expect(result.actions).toEqual([{ name: 'list_entries', headers: {}, body: '' }]);
  });

  it('parses <tool_call name="list_entries"> and self-closing tags', () => {
    expect(parseActions('<tool_call name="list_entries"></tool_call>').actions[0].name).toBe(
      'list_entries',
    );
    expect(parseActions('<tool_call name="list_entries"/>').actions[0].name).toBe('list_entries');
  });

  it('parses add_entry inside <tool_call>', () => {
    const result = parseActions(`<tool_call>
add_entry
name: Harbor
keys: harbor, port
---
A busy harbor.
</tool_call>`);
    expect(result.actions[0]).toEqual({
      name: 'add_entry',
      headers: { name: 'Harbor', keys: 'harbor, port' },
      body: 'A busy harbor.',
    });
  });

  it('parses list_entries() and a tool_calls wrapper', () => {
    const result = parseActions(
      '<tool_calls>\n<tool_call>\nlist_entries()\n</tool_call>\n</tool_calls>',
    );
    expect(result.actions).toEqual([{ name: 'list_entries', headers: {}, body: '' }]);
  });

  it('marks an unclosed <tool_call> as incomplete', () => {
    const result = parseActions('<tool_call> list_entries');
    expect(result.incomplete).toBe(true);
    expect(result.actions).toEqual([]);
  });

  it('does not treat <tool_calls> alone as an action', () => {
    const result = parseActions('Use <tool_calls> only as a wrapper.');
    expect(result.actions).toEqual([]);
    expect(result.incomplete).toBe(false);
  });
});

describe('stripFences', () => {
  it('returns speech without fence markup', () => {
    expect(stripFences(ADD_ENTRY)).toBe("I'll add the capital.");
  });

  it('hides an in-progress fence so the live stream can stay speech-only', () => {
    expect(stripFences("Hello.\n<<<add_entry\nname: Keep\n---\nThe keep")).toBe('Hello.');
  });

  it('strips <tool_call> blocks from speech', () => {
    expect(stripFences('Checking.\n<tool_call> list_entries </tool_call>')).toBe('Checking.');
  });
});
