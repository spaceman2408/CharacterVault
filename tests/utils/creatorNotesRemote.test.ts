import { describe, expect, it } from 'vitest';
import { hasRemoteReference } from '../../src/utils/creatorNotesRemote';

describe('hasRemoteReference', () => {
  it.each([
    '<img src="https://example.com/banner.png">',
    "<img src='//cdn.example.com/a.gif'>",
    '<img srcset="https://example.com/a.png 2x">',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">',
    '<div style="background: url(https://example.com/bg.jpg)"></div>',
    "<style>.x { background-image: url( 'http://example.com/bg.jpg' ) }</style>",
    '<style>@import "https://fonts.googleapis.com/css2";</style>',
    '<style>@import url(https://fonts.googleapis.com/css2);</style>',
  ])('flags %s', (content) => {
    expect(hasRemoteReference(content)).toBe(true);
  });

  it.each([
    'Plain notes that mention https://example.com in text.',
    '<img src="data:image/png;base64,AAAA">',
    '<div style="background: url(data:image/png;base64,AAAA)"></div>',
    '<p><b>Bold</b> text</p>',
  ])('ignores %s', (content) => {
    expect(hasRemoteReference(content)).toBe(false);
  });
});
