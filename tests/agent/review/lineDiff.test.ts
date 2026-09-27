import { describe, expect, it } from 'vitest';
import { diffLines, toSplitRows, type LineRow } from '../../../src/agent/review/lineDiff';

function kinds(rows: LineRow[]): string[] {
  return rows.map((row) => row.kind);
}

describe('diffLines', () => {
  it('returns no rows for empty texts', () => {
    const diff = diffLines('', '');
    expect(diff.rows).toEqual([]);
    expect(diff.addedWords).toBe(0);
    expect(diff.removedWords).toBe(0);
  });

  it('marks identical texts as unchanged rows with paragraph breaks', () => {
    const diff = diffLines('Para one.\n\nPara two.', 'Para one.\n\nPara two.');
    expect(diff.rows).toEqual([
      { kind: 'same', text: 'Para one.', breakBefore: false },
      { kind: 'same', text: 'Para two.', breakBefore: true },
    ]);
    expect(diff.addedWords).toBe(0);
    expect(diff.removedWords).toBe(0);
  });

  it('splits an append into unchanged plus added rows with true counts', () => {
    const before = '<START>\n{{char}}: A thousand pardons for the mess.';
    const after = `${before}\n\n{{char}}: A brand new second example greeting here.`;
    const diff = diffLines(before, after);
    expect(kinds(diff.rows)).toEqual(['same', 'same', 'add']);
    expect(diff.rows[2].breakBefore).toBe(true);
    expect(diff.removedWords).toBe(0);
    expect(diff.addedWords).toBe(8);
  });

  it('marks pure deletions with removed counts', () => {
    const diff = diffLines('Keep this.\n\nDrop this paragraph.', 'Keep this.');
    expect(kinds(diff.rows)).toEqual(['same', 'del']);
    expect(diff.removedWords).toBe(3);
    expect(diff.addedWords).toBe(0);
  });

  it('pairs a reworded line with its word diff', () => {
    const diff = diffLines(
      'Same intro.\n\nOld middle paragraph here.',
      'Same intro.\n\nNew middle paragraph here.',
    );
    expect(kinds(diff.rows)).toEqual(['same', 'pair']);
    expect(diff.rows[1].breakBefore).toBe(true);
    expect(diff.addedWords).toBe(1);
    expect(diff.removedWords).toBe(1);
  });

  it('leaves dissimilar lines unpaired but keeps true counts', () => {
    const before = 'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu.';
    const after = 'One two three four five six seven eight nine ten eleven twelve.';
    const diff = diffLines(`Shared intro.\n\n${before}`, `Shared intro.\n\n${after}`);
    expect(kinds(diff.rows)).toEqual(['same', 'del', 'add']);
    expect(diff.addedWords).toBe(12);
    expect(diff.removedWords).toBe(12);
  });

  it('marks a wholly new text as added', () => {
    const diff = diffLines('', 'Something new here.');
    expect(kinds(diff.rows)).toEqual(['add']);
    expect(diff.addedWords).toBe(3);
  });

  it('orders interleaved changes sequentially', () => {
    const diff = diffLines('A.\n\nB.\n\nC.', 'A.\n\nB edited.\n\nC.\n\nD.');
    expect(kinds(diff.rows)).toEqual(['same', 'pair', 'same', 'add']);
  });

  it('normalizes CRLF and collapses blank-line runs into one break', () => {
    const diff = diffLines('A.\r\n\r\n\r\nB.', 'A.\n\nB.');
    expect(diff.rows).toEqual([
      { kind: 'same', text: 'A.', breakBefore: false },
      { kind: 'same', text: 'B.', breakBefore: true },
    ]);
  });

  it('keeps identical lines plain inside a reworded block', () => {
    const before = 'Name: Athena\nAge: 34\nAthena is a seasoned knight of great renown.';
    const after = 'Name: Athena\nAge: 34\nSeasoned knight with no life outside duty.';
    const diff = diffLines(`{{char}} description\n\n${before}`, `{{char}} description\n\n${after}`);
    expect(kinds(diff.rows)).toEqual(['same', 'same', 'same', 'del', 'add']);
    expect(diff.removedWords).toBeLessThan(10);
    expect(diff.addedWords).toBeLessThan(10);
  });

  it('aligns single-newline originals against re-paragraphed rewrites', () => {
    const before = 'Name: Athena\nAge: 34\nGender: Female';
    const after = 'Name: Athena\n\nAge: 34\n\nGender: Female\n\nRace: Human';
    const diff = diffLines(before, after);
    expect(kinds(diff.rows)).toEqual(['same', 'same', 'same', 'add']);
    expect(diff.rows.map((row) => row.breakBefore)).toEqual([false, true, true, true]);
    expect(diff.addedWords).toBe(2);
    expect(diff.removedWords).toBe(0);
  });

  it('keeps word highlights on a long paragraph with many small edits', () => {
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`);
    const edited = words.map((word, i) => (i % 5 === 0 ? `${word}x` : word));
    const diff = diffLines(words.join(' '), edited.join(' '));
    expect(kinds(diff.rows)).toEqual(['pair']);
    expect(diff.addedWords).toBe(16);
    expect(diff.removedWords).toBe(16);
  });

  it('pairs several reworded lines in one block by similarity', () => {
    const before = 'Name: Athena\nShe is a brave knight of the realm.\nShe loves quiet evenings by the fire.';
    const after = 'Name: Athena\nShe is a bold knight of the realm.\nShe loves long evenings by the fire.';
    const diff = diffLines(before, after);
    expect(kinds(diff.rows)).toEqual(['same', 'pair', 'pair']);
    expect(diff.addedWords).toBe(2);
    expect(diff.removedWords).toBe(2);
  });

  it('pairs a split paragraph with the half it came from', () => {
    const before = 'Athena guards the northern gate every night. She never sleeps.';
    const after = 'Athena guards the northern gate every night.\n\nShe never sleeps.';
    const diff = diffLines(before, after);
    expect(kinds(diff.rows)).toEqual(['pair', 'add']);
    expect(diff.rows[1].breakBefore).toBe(true);
  });

  it('pairs removed and added lines across the whole change run', () => {
    const before = 'Keep.\nThe old tower stands tall.\nA river runs by it.';
    const after = 'Keep.\nA brand new opening line.\nThe old tower stands very tall.\nA river runs past it.';
    const diff = diffLines(before, after);
    expect(kinds(diff.rows)).toEqual(['same', 'add', 'pair', 'pair']);
  });
});

describe('toSplitRows', () => {
  it('shares rows between unpaired removals and additions', () => {
    const before = 'Keep.\nAlpha beta gamma.\nDelta epsilon zeta.';
    const after = 'Keep.\nOne two three.';
    const split = toSplitRows(diffLines(before, after).rows);
    expect(split).toHaveLength(3);
    expect(split[1].left).toEqual({ tone: 'changed', text: 'Alpha beta gamma.' });
    expect(split[1].right).toEqual({ tone: 'changed', text: 'One two three.' });
    expect(split[2].left).toEqual({ tone: 'changed', text: 'Delta epsilon zeta.' });
    expect(split[2].right).toBeNull();
  });

  it('filters word segments per side for paired lines', () => {
    const split = toSplitRows(diffLines('A quiet cartographer.', 'A careful cartographer.').rows);
    expect(split).toHaveLength(1);
    const { left, right } = split[0];
    expect(left?.tone === 'words' && left.segments.map((s) => s.type)).toEqual(['same', 'del', 'same']);
    expect(right?.tone === 'words' && right.segments.map((s) => s.type)).toEqual(['same', 'add', 'same']);
  });

  it('carries paragraph breaks from either side', () => {
    const split = toSplitRows(diffLines('A.\nB.', 'A.\n\nB.').rows);
    expect(split.map((row) => row.breakBefore)).toEqual([false, true]);
  });
});
