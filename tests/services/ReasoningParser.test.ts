import { describe, expect, it } from 'vitest';
import {
  ReasoningFormat,
  ReasoningParser,
  detectReasoningFormat,
  extractMessageReasoning,
  extractStructuredReasoning,
  STRUCTURED_FIELD_EXTRACTORS,
  parseInlineTags,
  type ChatCompletionChunk,
  type ReasoningSource,
} from '../../src/services/ReasoningParser';
import { FORMAT_HINT_RULES } from '../../src/services/reasoning/formatHints';

function chunk(delta: ReasoningSource & { content?: string }, choiceReasoning?: string): ChatCompletionChunk {
  return {
    id: '1',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'test',
    choices: [
      {
        index: 0,
        delta: {
          content: delta.content ?? undefined,
          reasoning_content: delta.reasoning_content ?? undefined,
          reasoning: delta.reasoning ?? undefined,
          reasoning_details: delta.reasoning_details ?? undefined,
        },
        finish_reason: null,
        reasoning: choiceReasoning ? { content: choiceReasoning } : undefined,
      },
    ],
  };
}

describe('STRUCTURED_FIELD_EXTRACTORS', () => {
  it('has stable ids for registry maintenance', () => {
    const ids = STRUCTURED_FIELD_EXTRACTORS.map((e) => e.id);
    expect(ids).toEqual([
      'delta.reasoning_content',
      'delta.reasoning',
      'choice.reasoning.content',
      'delta.reasoning_details',
    ]);
  });

  it('prefers reasoning_content over reasoning', () => {
    expect(
      extractStructuredReasoning({
        reasoning_content: 'from-content-field',
        reasoning: 'from-reasoning',
      })
    ).toBe('from-content-field');
  });

  it('extracts NanoGPT reasoning field', () => {
    expect(extractStructuredReasoning({ reasoning: 'nano-think' })).toBe('nano-think');
  });

  it('extracts OpenRouter choice.reasoning.content', () => {
    expect(
      extractStructuredReasoning({ choiceReasoningContent: 'or-think' })
    ).toBe('or-think');
  });

  it('extracts Minimax reasoning_details texts', () => {
    expect(
      extractStructuredReasoning({
        reasoning_details: [{ text: 'a' }, { type: 'x', text: 'b' }, { text: '' }],
      })
    ).toBe('ab');
  });

  it('returns empty when nothing present', () => {
    expect(extractStructuredReasoning({})).toBe('');
  });
});

describe('extractMessageReasoning', () => {
  it('reads final message structured fields', () => {
    expect(
      extractMessageReasoning({
        content: 'hi',
        reasoning_content: 'why',
      })
    ).toBe('why');
  });

  it('returns undefined when absent', () => {
    expect(extractMessageReasoning({ content: 'hi' })).toBeUndefined();
  });
});

describe('detectReasoningFormat', () => {
  it('hints separate field for known families', () => {
    expect(detectReasoningFormat('deepseek-r1')).toBe(ReasoningFormat.SEPARATE_FIELD);
    expect(detectReasoningFormat('foo:thinking')).toBe(ReasoningFormat.SEPARATE_FIELD);
    expect(detectReasoningFormat('bar-thinking')).toBe(ReasoningFormat.SEPARATE_FIELD);
    expect(detectReasoningFormat('MiniMax-M2')).toBe(ReasoningFormat.SEPARATE_FIELD);
  });

  it('hints inline tags for qwen/gemma and default', () => {
    expect(detectReasoningFormat('qwen-turbo')).toBe(ReasoningFormat.INLINE_TAGS);
    expect(detectReasoningFormat('QwQ-32B')).toBe(ReasoningFormat.INLINE_TAGS);
    expect(detectReasoningFormat('gemma-4-27b')).toBe(ReasoningFormat.INLINE_TAGS);
    expect(detectReasoningFormat('unknown-model')).toBe(ReasoningFormat.INLINE_TAGS);
  });

  it('FORMAT_HINT_RULES cover the same families', () => {
    expect(FORMAT_HINT_RULES.map((r) => r.id)).toContain('minimax');
    expect(FORMAT_HINT_RULES.map((r) => r.id)).toContain('gemma-4');
  });
});

describe('parseInlineTags', () => {
  it('strips standard think tags', () => {
    expect(parseInlineTags('Hi <think>secret</think> there')).toEqual({
      text: 'Hi  there',
      reasoning: 'secret',
    });
  });

  it('handles Gemma channel markers', () => {
    expect(parseInlineTags('A <|channel>thought plan <channel|> B')).toEqual({
      text: 'A  B',
      reasoning: ' plan ',
    });
  });
});

describe('ReasoningParser streaming', () => {
  it('accumulates DeepSeek-style reasoning_content + content', () => {
    const parser = new ReasoningParser();
    parser.parseChunk(chunk({ reasoning_content: 'r1', content: '' }), 'deepseek-r1');
    parser.parseChunk(chunk({ reasoning_content: 'r2', content: 'ans' }), 'deepseek-r1');
    const out = parser.flush();
    expect(out.reasoning).toBe('r1r2');
    expect(out.content).toBe('ans');
  });

  it('accumulates NanoGPT reasoning field', () => {
    const parser = new ReasoningParser();
    parser.parseChunk(chunk({ reasoning: 'think', content: 'ok' }), 'some-model:thinking');
    expect(parser.flush()).toMatchObject({ reasoning: 'think', content: 'ok' });
  });

  it('accumulates Minimax reasoning_details', () => {
    const parser = new ReasoningParser();
    parser.parseChunk(
      chunk({
        reasoning_details: [{ text: 'step1' }],
        content: '',
      }),
      'minimax-m2'
    );
    parser.parseChunk(
      chunk({
        reasoning_details: [{ text: 'step2' }],
        content: 'done',
      }),
      'minimax-m2'
    );
    const out = parser.flush();
    expect(out.reasoning).toBe('step1step2');
    expect(out.content).toBe('done');
  });

  it('extracts OpenRouter choice.reasoning.content', () => {
    const parser = new ReasoningParser();
    const c = chunk({ content: 'hello' }, 'or-reason');
    parser.parseChunk(c, 'openrouter-model');
    expect(parser.flush().reasoning).toBe('or-reason');
  });

  it('splits think tags across chunks', () => {
    const parser = new ReasoningParser();
    parser.parseChunk(chunk({ content: 'Hi <thi' }), 'qwen-test');
    parser.parseChunk(chunk({ content: 'nk>secret</th' }), 'qwen-test');
    parser.parseChunk(chunk({ content: 'ink> out' }), 'qwen-test');
    const out = parser.flush();
    expect(out.reasoning).toBe('secret');
    expect(out.content).toBe('Hi  out');
  });

  it('handles Gemma channel tags across chunks', () => {
    const parser = new ReasoningParser();
    parser.parseChunk(chunk({ content: 'X <|channel>tho' }), 'gemma-4-x');
    parser.parseChunk(chunk({ content: 'ught idea <channel|> Y' }), 'gemma-4-x');
    const out = parser.flush();
    expect(out.reasoning).toBe(' idea ');
    expect(out.content).toBe('X  Y');
  });

  it('reset clears state', () => {
    const parser = new ReasoningParser();
    parser.parseChunk(chunk({ content: 'Hello from the model' }), 'qwen-test');
    expect(parser.flush().content.length).toBeGreaterThan(0);
    parser.reset();
    const after = parser.flush();
    expect(after.content).toBe('');
    expect(after.reasoning).toBe('');
  });

  it('strips think tags from content when structured reasoning is also present', () => {
    const parser = new ReasoningParser();
    parser.parseChunk(
      chunk({
        reasoning_content: 'field',
        content: 'vis <think>dup</think> ible',
      }),
      'deepseek-r1'
    );
    const out = parser.flush();
    expect(out.reasoning).toBe('field');
    expect(out.content).toBe('vis  ible');
  });
});
