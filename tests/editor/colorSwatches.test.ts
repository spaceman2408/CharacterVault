// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { findCssColors, replaceColorKeepingFormat } from '../../src/editor/extensions/colorSwatches';

describe('findCssColors', () => {
  it('finds colors in style blocks and style attributes only', () => {
    const doc = '<p>#fff in text</p><style>.a{color:#ff0080;background:rgba(0, 0, 0, 0.5)}</style><div style="border:1px solid hsl(200, 50%, 40%)">#abc</div>';
    const found = findCssColors(doc).map((m) => doc.slice(m.from, m.to));
    expect(found).toEqual(['#ff0080', 'rgba(0, 0, 0, 0.5)', 'hsl(200, 50%, 40%)']);
  });

  it('skips hex-looking ids and longer words', () => {
    const doc = '<style>#header{color:#12345;border-color:#abcdefgh} .x{color:#ABC}</style>';
    expect(findCssColors(doc).map((m) => m.color)).toEqual(['#ABC']);
  });

  it('does not match inside the style attribute name', () => {
    const doc = "<div style='color:#0f0'></div>";
    const [match] = findCssColors(doc);
    expect(doc.slice(match.from, match.to)).toBe('#0f0');
  });
});

describe('replaceColorKeepingFormat', () => {
  it.each([
    ['#123456', '#ff0000', '#ff0000'],
    ['#12345680', '#ff0000', '#ff000080'],
    ['rgb(1, 2, 3)', '#00ff00', 'rgb(0, 255, 0)'],
    ['rgba(1, 2, 3, 0.4)', '#00ff00', 'rgba(0, 255, 0, 0.4)'],
    ['hsl(10, 20%, 30%)', '#ff0000', 'hsl(0, 100%, 50%)'],
    ['hsla(10, 20%, 30%, 50%)', '#0000ff', 'hsla(240, 100%, 50%, 0.5)'],
  ])('%s picked %s becomes %s', (original, picked, expected) => {
    expect(replaceColorKeepingFormat(original, picked)).toBe(expected);
  });
});
