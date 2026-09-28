// @vitest-environment jsdom
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
    '<img src="&#104;ttps://example.com/pixel.gif">',
    '<img src="https&colon;&sol;&sol;example.com/pixel.gif">',
    '<div style="background: url(\\68 ttps://example.com/bg.jpg)"></div>',
    '<style>.x { background: url(\\2f\\2f example.com/bg.jpg) }</style>',
    '<table background="https://example.com/bg.jpg"></table>',
    '<img srcset="local.png 1x, https://example.com/a.png 2x">',
    '<div style="background-image: image-set(\'https://example.com/a.png\' 1x)"></div>',
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
