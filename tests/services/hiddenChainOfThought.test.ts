import { describe, expect, it } from 'vitest';
import {
  HIDDEN_COT_NOTE,
  getHiddenChainOfThoughtNote,
  modelWithholdsReasoningText,
} from '../../src/services/reasoning/hiddenChainOfThought';

describe('getHiddenChainOfThoughtNote', () => {
  it('returns null for empty or ordinary models', () => {
    expect(getHiddenChainOfThoughtNote(undefined)).toBeNull();
    expect(getHiddenChainOfThoughtNote('')).toBeNull();
    expect(getHiddenChainOfThoughtNote('deepseek/deepseek-r1')).toBeNull();
    expect(getHiddenChainOfThoughtNote('anthropic/claude-sonnet-4')).toBeNull();
    expect(getHiddenChainOfThoughtNote('meta/muse-glimmer-30b')).toBeNull();
  });

  it('flags Meta Muse Spark ids', () => {
    expect(getHiddenChainOfThoughtNote('meta/muse-spark-1.2')).toBe(HIDDEN_COT_NOTE);
    expect(getHiddenChainOfThoughtNote('muse-spark-1.1')).toBe(HIDDEN_COT_NOTE);
    expect(modelWithholdsReasoningText('Muse-Spark-1.2-contributor')).toBe(true);
  });

  it('flags OpenAI o-series without matching unrelated ids', () => {
    expect(getHiddenChainOfThoughtNote('openai/o1')).toBe(HIDDEN_COT_NOTE);
    expect(getHiddenChainOfThoughtNote('openai/o3-mini')).toBe(HIDDEN_COT_NOTE);
    expect(getHiddenChainOfThoughtNote('o4-mini')).toBe(HIDDEN_COT_NOTE);
    expect(getHiddenChainOfThoughtNote('openai/gpt-4o')).toBeNull();
    expect(getHiddenChainOfThoughtNote('foo/proto-1')).toBeNull();
  });
});
