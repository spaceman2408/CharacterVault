import { describe, expect, it } from 'vitest';
import { diffParagraphs } from '../../../src/agent/review/paragraphDiff';

describe('diffParagraphs', () => {
  it('returns no rows for empty texts', () => {
    const diff = diffParagraphs('', '');
    expect(diff.rows).toEqual([]);
    expect(diff.addedWords).toBe(0);
    expect(diff.removedWords).toBe(0);
  });

  it('marks identical texts as one unchanged run', () => {
    const diff = diffParagraphs('Para one.\n\nPara two.', 'Para one.\n\nPara two.');
    expect(diff.rows).toEqual([{ kind: 'same', paras: ['Para one.', 'Para two.'] }]);
    expect(diff.addedWords).toBe(0);
    expect(diff.removedWords).toBe(0);
  });

  it('splits an append into unchanged plus added rows with true counts', () => {
    const before = '<START>\n{{char}}: A thousand pardons for the mess.';
    const after = `${before}\n\n{{char}}: A brand new second example greeting here.`;
    const diff = diffParagraphs(before, after);
    expect(diff.rows.map((row) => row.kind)).toEqual(['same', 'add']);
    expect(diff.removedWords).toBe(0);
    expect(diff.addedWords).toBe(8);
  });

  it('marks pure deletions with removed counts', () => {
    const diff = diffParagraphs('Keep this.\n\nDrop this paragraph.', 'Keep this.');
    expect(diff.rows.map((row) => row.kind)).toEqual(['same', 'del']);
    expect(diff.removedWords).toBe(3);
    expect(diff.addedWords).toBe(0);
  });

  it('pairs adjacent removals and additions into a replace row', () => {
    const diff = diffParagraphs(
      'Same intro.\n\nOld middle paragraph here.',
      'Same intro.\n\nNew middle paragraph here.',
    );
    expect(diff.rows.map((row) => row.kind)).toEqual(['same', 'replace']);
    const replace = diff.rows[1];
    expect(replace.kind).toBe('replace');
    if (replace.kind === 'replace') {
      expect(replace.left.map((part) => part.kind)).toEqual(['words']);
      expect(replace.right.map((part) => part.kind)).toEqual(['words']);
    }
    expect(diff.addedWords).toBe(1);
    expect(diff.removedWords).toBe(1);
  });

  it('skips word highlights for dissimilar pairs but keeps true counts', () => {
    const before = `Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu.`;
    const after = `One two three four five six seven eight nine ten eleven twelve.`;
    const diff = diffParagraphs(`Shared intro.\n\n${before}`, `Shared intro.\n\n${after}`);
    expect(diff.rows.map((row) => row.kind)).toEqual(['same', 'replace']);
    const replace = diff.rows[1];
    expect(replace.kind).toBe('replace');
    if (replace.kind === 'replace') {
      expect(replace.left.every((part) => part.kind === 'changed')).toBe(true);
      expect(replace.right.every((part) => part.kind === 'changed')).toBe(true);
    }
    expect(diff.addedWords).toBe(12);
    expect(diff.removedWords).toBe(12);
  });

  it('marks a wholly new text as added', () => {
    const diff = diffParagraphs('', 'Something new here.');
    expect(diff.rows.map((row) => row.kind)).toEqual(['add']);
    expect(diff.addedWords).toBe(3);
  });

  it('orders interleaved changes sequentially', () => {
    const diff = diffParagraphs('A.\n\nB.\n\nC.', 'A.\n\nB edited.\n\nC.\n\nD.');
    expect(diff.rows.map((row) => row.kind)).toEqual(['same', 'replace', 'same', 'add']);
  });

  it('normalizes CRLF and drops blank-only paragraphs', () => {
    const diff = diffParagraphs('A.\r\n\r\n\r\nB.', 'A.\n\nB.');
    expect(diff.rows).toEqual([{ kind: 'same', paras: ['A.', 'B.'] }]);
  });

  it('keeps identical lines plain inside a reworded block', () => {
    const before = 'Name: Athena\nAge: 34\nAthena is a seasoned knight of great renown.';
    const after = 'Name: Athena\nAge: 34\nSeasoned knight with no life outside duty.';
    const diff = diffParagraphs(`{{char}} description\n\n${before}`, `{{char}} description\n\n${after}`);
    expect(diff.rows.map((row) => row.kind)).toEqual(['same', 'replace']);
    const replace = diff.rows[1];
    expect(replace.kind).toBe('replace');
    if (replace.kind === 'replace') {
      const leftSame = replace.left.filter((part) => part.kind === 'same');
      expect(leftSame).toHaveLength(1);
      if (leftSame[0]?.kind === 'same') {
        expect(leftSame[0].text).toContain('Name: Athena');
        expect(leftSame[0].text).toContain('Age: 34');
      }
      expect(replace.right.filter((part) => part.kind === 'same')).toHaveLength(1);
    }
    expect(diff.removedWords).toBeLessThan(10);
    expect(diff.addedWords).toBeLessThan(10);
  });

  it('aligns single-newline originals against re-paragraphed rewrites', () => {
    const before = 'Name: Athena\nAge: 34\nGender: Female';
    const after = 'Name: Athena\n\nAge: 34\n\nGender: Female\n\nRace: Human';
    const diff = diffParagraphs(before, after);
    expect(diff.rows.map((row) => row.kind)).toEqual(['replace']);
    const replace = diff.rows[0];
    expect(replace.kind).toBe('replace');
    if (replace.kind === 'replace') {
      expect(replace.left.every((part) => part.kind === 'same')).toBe(true);
      expect(replace.right.map((part) => part.kind)).toEqual(['same', 'changed']);
    }
    expect(diff.addedWords).toBe(2);
    expect(diff.removedWords).toBe(0);
  });
});
