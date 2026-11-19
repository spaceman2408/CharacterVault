// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CREATOR_NOTES_SNIPPETS, padSnippetForInsert } from '../../../src/components/editor/creatorNotesSnippets';
import { formatCreatorNotesCss } from '../../../src/utils/creatorNotesCssFormat';
import { renderCreatorNotesLikeSillyTavern } from '../../../src/utils/creatorNotesRender';

const render = (notes: string) => renderCreatorNotesLikeSillyTavern(notes, { charName: 'Aria' });

describe('CREATOR_NOTES_SNIPPETS', () => {
  it.each(CREATOR_NOTES_SNIPPETS.map((s) => [s.label, s.code]))('%s survives SillyTavern untouched', (_label, code) => {
    const { bodyContent, notices } = render(code);
    expect(notices).toEqual([]);
    expect(bodyContent).not.toMatch(/CSS ERROR|<pre|<code/);
    expect(bodyContent).toContain('#creator_notes_spoiler .custom-cv-');
    expect(bodyContent).not.toContain('{{char}}');
  });

  it('all render together after other notes', () => {
    const notes = ['Intro **text**', ...CREATOR_NOTES_SNIPPETS.map((s) => s.code)].join('\n');
    const { bodyContent, notices } = render(notes);
    expect(notices).toEqual([]);
    expect(bodyContent).not.toMatch(/<pre|<code|&lt;div/);
  });

  it('are already in Format style', () => {
    for (const snippet of CREATOR_NOTES_SNIPPETS) {
      expect(formatCreatorNotesCss(snippet.code)).toBe(snippet.code);
    }
  });
});

describe('padSnippetForInsert', () => {
  it.each([
    ['', '', 'X\n'],
    ['text', '', '\n\nX\n'],
    ['text\n', '', '\nX\n'],
    ['text\n\n', '\nmore', 'X\n'],
    ['', 'more', 'X\n\n'],
    ['a\n\n', '\n\nb', 'X'],
  ])('before %j, after %j', (before, after, expected) => {
    expect(padSnippetForInsert('X\n', before, after)).toBe(expected);
  });
});
