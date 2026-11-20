import { describe, expect, it } from 'vitest';
import { formatBytes, measureCreatorNotes } from '../../src/utils/creatorNotesSize';

describe('measureCreatorNotes', () => {
  it('counts UTF-8 bytes', () => {
    expect(measureCreatorNotes('a·b').bytes).toBe(4);
  });

  it('counts embedded images and their size', () => {
    const png = 'data:image/png;base64,' + 'A'.repeat(100);
    const svg = 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E';
    const notes = `<img src="${png}"><div style="background:url('${svg}')"></div><a href="https://x.test">x</a>`;
    expect(measureCreatorNotes(notes)).toMatchObject({ embeddedImages: 2, embeddedBytes: png.length + svg.length });
  });

  it('reports no embedded images for plain notes', () => {
    expect(measureCreatorNotes('<b>hi</b>')).toMatchObject({ embeddedImages: 0, embeddedBytes: 0 });
  });
});

describe('formatBytes', () => {
  it.each([
    [512, '512 B'],
    [3482, '3.4 KB'],
    [245760, '240 KB'],
    [1258291, '1.2 MB'],
  ])('%i → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});
