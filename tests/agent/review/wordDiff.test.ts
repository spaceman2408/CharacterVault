import { describe, expect, it } from 'vitest';
import { diffWords } from '../../../src/agent/review/wordDiff';

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
});
