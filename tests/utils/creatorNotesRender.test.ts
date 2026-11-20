// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderCreatorNotesLikeSillyTavern } from '../../src/utils/creatorNotesRender';

const render = (text: string, allowExternalMedia = false) => {
  const { bodyContent, notices } = renderCreatorNotesLikeSillyTavern(text, { charName: 'Aria', allowExternalMedia });
  return { html: bodyContent, notices };
};

describe('renderCreatorNotesLikeSillyTavern', () => {
  it('renders markdown with single line breaks', () => {
    const { html } = render('**Bold** and __under__\nnext line');
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<u>under</u>');
    expect(html).toContain('<br');
  });

  it('italicizes single underscores outside code and style', () => {
    expect(render('_soft_').html).toContain('<em>soft</em>');
  });

  it('substitutes char and user macros case-insensitively', () => {
    const { html } = render('Hi {{USER}}, I am {{char}} aka <BOT>.');
    expect(html).toContain('Hi User, I am Aria aka Aria.');
  });

  it('prefixes classes in markup and selectors in style blocks', () => {
    const { html } = render('<style>.banner { color: red; }</style>\n<div class="banner fa-star">x</div>');
    expect(html).toContain('#creator_notes_spoiler .custom-banner');
    expect(html).toContain('class="custom-banner fa-star"');
  });

  it('flags :root, html, and body selectors that stop matching', () => {
    const { html, notices } = render('<style>:root { --c: red; } body { margin: 0; }</style>');
    expect(html).toContain('#creator_notes_spoiler :root');
    expect(notices).toContain(':root, html, and body styles won’t apply');
  });

  it('does not flag selectors that only contain the words', () => {
    expect(render('<style>.body-text { color: red; }</style>').notices).toEqual([]);
  });

  it('drops @import', () => {
    const { html, notices } = render('<style>@import url("x.css"); .a { color: red; }</style>');
    expect(html).not.toContain('@import');
    expect(notices).toContain('@import removed');
  });

  it('blocks remote media and remote CSS urls unless allowed', () => {
    const text = '<style>.a { background: url(https://example.com/a.png); color: red; }</style><img src="https://example.com/b.png"><img src="data:image/png;base64,AAAA">';
    const blocked = render(text);
    expect(blocked.html).not.toContain('example.com');
    expect(blocked.html).toContain('data:image/png');
    expect(blocked.notices).toEqual(expect.arrayContaining([
      'Remote images and media hidden',
      'Styles with remote URLs removed',
    ]));

    const allowed = render(text, true);
    expect(allowed.html).toContain('https://example.com/b.png');
    expect(allowed.html).toContain('url(https://example.com/a.png)');
    expect(allowed.notices).toEqual([]);
  });

  it('removes scripts, iframes, and event handlers and lists them', () => {
    const { html, notices } = render('<div onclick="x()">a</div><iframe src="/x"></iframe><script>x()</script>');
    expect(html).not.toMatch(/onclick|<iframe|<script/);
    const removed = notices.find((n) => n.startsWith('Removed:'));
    expect(removed).toContain('onclick');
    expect(removed).toContain('<iframe>');
    expect(removed).toContain('<script>');
  });

  it('breaks on a comment inside a rule the way ST does', () => {
    const { html, notices } = render('<style>.a { color: red; /* note */ }</style>');
    expect(html).toContain('CSS ERROR');
    expect(notices).toContain('Comments inside CSS rules break the style block');
    expect(render('<style>.a { color: red; /* note */ }</style>', true).html).not.toContain('CSS ERROR');
  });

  it('reports unparseable CSS', () => {
    const { html, notices } = render('<style>.a { color: red;</style>');
    expect(html).toContain('CSS ERROR');
    expect(notices).toContain('CSS error: a style block shows as text');
  });

  it('wraps output in the element ST scopes styles to', () => {
    expect(render('hi').html).toMatch(/^<div id="creator_notes_spoiler">[\s\S]*<\/div>$/);
  });

  it('hides the blank lines a full-page wrapper leaves at the edges', () => {
    const page = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="UTF-8">',
      '<title>Notes</title>',
      '<link href="https://fonts.example.com/a.css" rel="stylesheet">',
      '<style>.card { color: red; }</style>',
      '</head>',
      '<body>',
      '',
      '<div class="card">Hello</div>',
      '</body>',
      '</html>',
    ].join('\n');
    const { html, notices } = render(page);
    const body = html.replace(/^<div id="creator_notes_spoiler">|<\/div>$/g, '');
    expect(body).toMatch(/^\s*<style>[\s\S]*<\/style>\s*<div class="custom-card">Hello<\/div>\s*$/);
    expect(notices).toContain('Removed: <meta>, <link>');
  });

  it('keeps blank lines between content', () => {
    expect(render('one\n\n<br>\n\ntwo').html).toContain('<br');
  });

  it('keeps keyframes intact', () => {
    const { html } = render('<style>@keyframes pulse { from { opacity: 0; } to { opacity: 1; } }</style>');
    expect(html).toContain('@keyframes pulse');
    expect(html).not.toContain('#creator_notes_spoiler from');
  });
});
