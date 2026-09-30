/**
 * @fileoverview Tests for Markdown image detection and URL safety helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  findMarkdownImages,
  findMarkdownImageRanges,
  isOpenableHttpUrl,
  formatUrlForDisplay,
} from '../../src/editor/markdownImage/findMarkdownImages';

describe('findMarkdownImages', () => {
  it('matches empty-alt image URLs', () => {
    const text = '![](https://file.garden/akviCfKE-zqjKa2t/Shu/shu_cheeky.webp)';
    const matches = findMarkdownImages(text);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      from: 0,
      to: text.length,
      alt: '',
      url: 'https://file.garden/akviCfKE-zqjKa2t/Shu/shu_cheeky.webp',
    });
  });

  it('matches alt text', () => {
    const text = 'See ![face](https://cdn.example.com/x.png) here';
    const matches = findMarkdownImages(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].alt).toBe('face');
    expect(matches[0].url).toBe('https://cdn.example.com/x.png');
    expect(text.slice(matches[0].from, matches[0].to)).toBe(
      '![face](https://cdn.example.com/x.png)',
    );
  });

  it('matches optional title and angle-bracket URLs', () => {
    const withTitle = findMarkdownImages('![a](https://ex.com/i.webp "title")');
    expect(withTitle[0]?.url).toBe('https://ex.com/i.webp');
    expect(withTitle[0]?.title).toBe('title');

    const angled = findMarkdownImages('![](<https://ex.com/a b.png>)');
    expect(angled[0]?.url).toBe('https://ex.com/a b.png');
  });

  it('finds multiple images on one line', () => {
    const text = '![](https://a.com/1.png) and ![x](https://b.com/2.png)';
    expect(findMarkdownImages(text)).toHaveLength(2);
  });

  it('ignores incomplete or non-image syntax', () => {
    expect(findMarkdownImages('![not closed')).toEqual([]);
    expect(findMarkdownImages('[not an image](https://x.com)')).toEqual([]);
    expect(findMarkdownImages('https://plain.url/no-md')).toEqual([]);
  });

  it('keeps one level of balanced parentheses in a bare URL', () => {
    const text = 'x ![](https://en.wikipedia.org/wiki/Foo_(bar).png) y';
    const [match] = findMarkdownImages(text);
    expect(match.url).toBe('https://en.wikipedia.org/wiki/Foo_(bar).png');
    expect(text.slice(match.urlFrom, match.urlTo)).toBe(match.url);
    expect(text.slice(match.to)).toBe(' y');

    const titled = findMarkdownImages('![a](https://ex.com/a_(1).png (title))');
    expect(titled[0]?.url).toBe('https://ex.com/a_(1).png');
    expect(titled[0]?.title).toBe('title');

    const trailing = findMarkdownImages('![](https://ex.com/a.png)(not part)');
    expect(trailing[0]?.url).toBe('https://ex.com/a.png');
  });

  it('reports urlFrom/urlTo covering the URL segment', () => {
    const text = '![alt](https://example.com/x.webp)';
    const [match] = findMarkdownImages(text);
    expect(text.slice(match.urlFrom, match.urlTo)).toBe('https://example.com/x.webp');
  });
});

describe('findMarkdownImageRanges', () => {
  it('returns from/to only', () => {
    const text = 'pre ![](https://x.com/a.webp) post';
    const ranges = findMarkdownImageRanges(text);
    expect(ranges).toHaveLength(1);
    expect(text.slice(ranges[0].from, ranges[0].to)).toContain('![](');
  });
});

describe('isOpenableHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isOpenableHttpUrl('https://example.com/a.webp')).toBe(true);
    expect(isOpenableHttpUrl('http://example.com/a.webp')).toBe(true);
  });

  it('rejects dangerous or non-http schemes', () => {
    expect(isOpenableHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isOpenableHttpUrl('data:text/html,hi')).toBe(false);
    expect(isOpenableHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isOpenableHttpUrl('/relative/path')).toBe(false);
    expect(isOpenableHttpUrl('example.com/no-scheme')).toBe(false);
    expect(isOpenableHttpUrl('')).toBe(false);
  });
});

describe('formatUrlForDisplay', () => {
  it('extracts host and truncates long URLs', () => {
    const long = `https://example.com/${'a'.repeat(120)}.webp`;
    const { host, truncated } = formatUrlForDisplay(long);
    expect(host).toBe('example.com');
    expect(truncated.length).toBeLessThanOrEqual(97);
    expect(truncated.endsWith('…')).toBe(true);
  });
});
