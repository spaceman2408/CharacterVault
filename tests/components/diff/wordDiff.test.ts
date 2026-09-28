import { describe, expect, it } from 'vitest';
import { diffWords } from '../../../src/components/diff/wordDiff';

function renderLeft(before: string, after: string): string {
  const { segments } = diffWords(before, after);
  return segments
    .filter((segment) => segment.type !== 'add')
    .map((segment) => (segment.type === 'del' ? `[-${segment.text}]` : segment.text))
    .join('');
}

function renderRight(before: string, after: string): string {
  const { segments } = diffWords(before, after);
  return segments
    .filter((segment) => segment.type !== 'del')
    .map((segment) => (segment.type === 'add' ? `{+${segment.text}}` : segment.text))
    .join('');
}

describe('diffWords', () => {
  it('returns no segments for identical text', () => {
    const result = diffWords('Hello world.', 'Hello world.');
    expect(result.truncated).toBe(false);
    expect(result.addedWords).toBe(0);
    expect(result.removedWords).toBe(0);
    expect(result.segments.every((segment) => segment.type === 'same')).toBe(true);
  });

  it('highlights a replaced word', () => {
    expect(renderLeft('A quiet cartographer.', 'A careful cartographer.')).toBe(
      'A [-quiet] cartographer.',
    );
    expect(renderRight('A quiet cartographer.', 'A careful cartographer.')).toBe(
      'A {+careful} cartographer.',
    );
    const result = diffWords('A quiet cartographer.', 'A careful cartographer.');
    expect(result.addedWords).toBe(1);
    expect(result.removedWords).toBe(1);
  });

  it('highlights insertions', () => {
    expect(renderRight('Hello there.', 'Hello brave world there.')).toBe(
      'Hello {+brave world }there.',
    );
    const result = diffWords('Hello there.', 'Hello brave world there.');
    expect(result.addedWords).toBe(2);
    expect(result.removedWords).toBe(0);
  });

  it('highlights deletions', () => {
    expect(renderLeft('Hello brave world there.', 'Hello there.')).toBe(
      'Hello [-brave world ]there.',
    );
  });

  it('handles empty sides', () => {
    const added = diffWords('', 'Something new.');
    expect(added.segments).toHaveLength(1);
    expect(added.segments[0].type).toBe('add');
    const removed = diffWords('Something old.', '');
    expect(removed.segments).toHaveLength(1);
    expect(removed.segments[0].type).toBe('del');
    expect(diffWords('', '').segments).toEqual([]);
  });

  it('marks very long texts as truncated', () => {
    const long = Array.from({ length: 3000 }, (_, i) => `word${i}`).join(' ');
    const result = diffWords(long, `${long} extra`);
    expect(result.truncated).toBe(true);
    expect(result.segments).toEqual([]);
  });

  it('highlights only the punctuation that changed', () => {
    const result = diffWords('Stop, please.', 'Stop. please.');
    expect(renderLeft('Stop, please.', 'Stop. please.')).toBe('Stop[-,] please.');
    expect(result.addedWords).toBe(0);
    expect(result.removedWords).toBe(0);
  });

  it('folds short unchanged islands into one phrase highlight', () => {
    expect(renderRight('She walks to the old mill.', 'He runs to a new mill.')).toBe(
      '{+He runs to a new} mill.',
    );
  });

  it('keeps true word counts after folding islands', () => {
    const result = diffWords('She walks to the old mill.', 'He runs to a new mill.');
    expect(result.removedWords).toBe(4);
    expect(result.addedWords).toBe(4);
  });

  it('reports similarity over kept words', () => {
    expect(diffWords('one two three four', 'one two three five').similarity).toBeCloseTo(0.75);
    expect(diffWords('alpha beta', 'gamma delta').similarity).toBe(0);
    expect(diffWords('same', 'same').similarity).toBe(1);
  });

  it('gives up on huge rewrites instead of exhausting memory', () => {
    const before = Array.from({ length: 1900 }, (_, i) => `old${i}`).join(' ');
    const after = Array.from({ length: 1900 }, (_, i) => `new${i}`).join(' ');
    expect(diffWords(before, after).truncated).toBe(true);
  });
});
