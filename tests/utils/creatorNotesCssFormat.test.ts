// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { creatorNotesCssFormatChanges, formatCreatorNotesCss, formatCss } from '../../src/utils/creatorNotesCssFormat';
import { renderCreatorNotesLikeSillyTavern } from '../../src/utils/creatorNotesRender';

const render = (notes: string) =>
  renderCreatorNotesLikeSillyTavern(notes, { charName: 'Aria', allowExternalMedia: true }).bodyContent;

describe('formatCss', () => {
  it('puts each declaration on its own line and indents blocks', () => {
    expect(formatCss('.a{color:red;margin:0 auto}@media (max-width:600px){.a{color:blue}}')).toBe([
      '.a {',
      '  color: red;',
      '  margin: 0 auto',
      '}',
      '@media (max-width:600px) {',
      '  .a {',
      '    color: blue',
      '  }',
      '}',
    ].join('\n'));
  });

  it('keeps semicolons inside url() and strings', () => {
    const out = formatCss('.a{background:url(data:image/png;base64,AAA=);content:"x;y"}');
    expect(out).toContain('background: url(data:image/png;base64,AAA=);');
    expect(out).toContain('content: "x;y"');
  });

  it('keeps custom properties and pseudo selectors', () => {
    const out = formatCss('.w{--accent:#f0f}.a:hover::after{content:"";color:var(--accent)}');
    expect(out).toContain('  --accent: #f0f');
    expect(out).toContain('.a:hover::after {');
  });

  it('keeps comments', () => {
    expect(formatCss('/* top */.a{color:red}')).toBe('/* top */\n.a {\n  color: red\n}');
  });
});

describe('formatCreatorNotesCss', () => {
  it('only touches style blocks and indents them from their line', () => {
    const notes = '<div class="x">\n    <b>hi</b>\n</div>\n  <style>.x{color:red}</style>';
    expect(formatCreatorNotesCss(notes)).toBe(
      '<div class="x">\n    <b>hi</b>\n</div>\n  <style>\n    .x {\n      color: red\n    }\n  </style>',
    );
  });

  it('changes only the style blocks that need it', () => {
    const notes = '<p>a</p>\n<style>.a{color:red}</style>\n<p>b</p>\n<style>\n  .b {\n    margin: 0\n  }\n</style>';
    const changes = creatorNotesCssFormatChanges(notes);
    expect(changes).toHaveLength(1);
    expect(notes.slice(changes[0].from, changes[0].to)).toBe('<style>.a{color:red}</style>');
  });

  it('is stable when run twice', () => {
    const once = formatCreatorNotesCss('<style>.a{color:red}.b{margin:0}</style>');
    expect(formatCreatorNotesCss(once)).toBe(once);
  });

  it('renders the same in SillyTavern before and after formatting', () => {
    const minified = '<style>.card{background:#123;padding:8px}.card h2{color:#fff;margin:0}@keyframes p{from{opacity:0}to{opacity:1}}</style>\n<div class="card"><h2>Hi</h2></div>';
    const strip = (html: string) => html.replace(/\s+/g, '');
    expect(strip(render(formatCreatorNotesCss(minified)))).toBe(strip(render(minified)));
  });
});
