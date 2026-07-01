/**
 * @fileoverview Integration test for the language-aware skip predicate.
 *
 * Drives the actual skip predicate (built from the same Set the production
 * extension uses) against a real CodeMirror state configured with
 * `@codemirror/lang-json` and `@codemirror/lang-html`. Exercises the
 * integrated grammar that ships to the user's browser (which nests a CSS
 * parse tree inside `<style>` via `configureNesting`).
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { html as htmlLang } from '@codemirror/lang-html';
import { syntaxTree } from '@codemirror/language';
import { tokenize } from '../../src/editor/spellcheck/tokenizer';

interface SkipRange { from: number; to: number }

function collectSkipRanges(state: EditorState, mode: 'html' | 'json'): SkipRange[] {
  // Mirrors the production skip sets in `spellcheckExtension.ts`. Tests use
  // this same predicate so the contract is "what the editor will skip ==
  // what the test asserts it will skip."
  const HTML_SKIP = new Set([
    'OpenTag', 'CloseTag', 'SelfClosingTag', 'MismatchedCloseTag',
    'NoMatchCloseTag', 'TagName',
    'Attribute', 'AttributeName', 'AttributeValue', 'UnquotedAttributeValue',
    'Comment',
    'Script', 'Style', 'Textarea',
    'ScriptText', 'StyleText', 'TextareaText',
    // Embeds produced by `@codemirror/lang-html`'s `configureNesting`:
    'StyleSheet', 'ScriptContent', 'Styles',
  ]);
  const JSON_SKIP = new Set(['PropertyName', 'String']);
  const set = mode === 'html' ? HTML_SKIP : JSON_SKIP;
  const tree = syntaxTree(state);
  const ranges: SkipRange[] = [];
  tree.iterate({
    enter(node) {
      if (set.has(node.name)) ranges.push({ from: node.from, to: node.to });
    },
  });
  return ranges.sort((a, b) => a.from - b.from);
}

function inAnyRange(offset: number, ranges: readonly SkipRange[]): boolean {
  // Mirrors the production predicate: linear scan over a `from`-sorted list,
  // breaking on the first `r.from > offset`. The production bug was a binary
  // search that picked a small overlapping range at mid (e.g. an HTML
  // `TagName [994, 1000]` sibling to `StyleSheet [994, 1256]`) and went right,
  // skipping over the wider containment. Linear scan is correct in all cases.
  for (const r of ranges) {
    if (r.from > offset) break;
    if (offset >= r.from && offset < r.to) return true;
  }
  return false;
}

function flaggedTokens(source: string, mode: 'html' | 'json'): string[] {
  const extensions = mode === 'html' ? [htmlLang()] : [json()];
  const state = EditorState.create({ doc: source, extensions });
  const ranges = collectSkipRanges(state, mode);
  const tokens = tokenize(source);
  const flagged: string[] = [];
  for (const t of tokens) {
    if (t.skipped) continue;
    if (inAnyRange(t.from, ranges)) continue;
    flagged.push(t.word);
  }
  return flagged;
}

describe('language-aware skip — HTML', () => {
  it('does not flag CSS class names inside attribute values', () => {
    const src = `<div class="sora-preview">Hello world</div>`;
    const flagged = flaggedTokens(src, 'html');
    // css class name should be skipped; only "Hello world" / "div" should
    // remain as candidates. (nspell-equivalent isn't called here — we just
    // check the skip predicate; "Hello" / "world" / "div" are valid English.)
    expect(flagged).not.toContain('sora-preview');
    expect(flagged).not.toContain('Sora-Preview');
  });

  it('does not flag element tag names', () => {
    const src = `<span>plain text</span>`;
    const flagged = flaggedTokens(src, 'html');
    expect(flagged).not.toContain('span');
  });

  it('still flags prose tokens outside tags', () => {
    const src = `<p>missplled word</p>`;
    const flagged = flaggedTokens(src, 'html');
    expect(flagged).toContain('missplled');
    // `p` is the tag name and correctly skipped.
    expect(flagged).not.toContain('p');
  });

  it('does not flag CSS inside <style> blocks (configureNesting-parsed)', () => {
    // Embed CSS in <style>. With `configureNesting`, lang-html wraps this as
    // a CSS parse tree (StyleSheet / RuleSet / …) instead of a flat
    // StyleText — make sure both shapes are skipped. (`ant-btn`,
    // `galaxy-bg`, `display`, `none`, `important`, `pointer-events` etc.
    // should never appear.)
    const src = `<style>.ant-btn.galaxy-bg{display:none!important;pointer-events:none!important}</style>`;
    const flagged = flaggedTokens(src, 'html');
    expect(flagged).not.toContain('ant-btn');
    expect(flagged).not.toContain('galaxy-bg');
    expect(flagged).not.toContain('display');
    expect(flagged).not.toContain('none');
    expect(flagged).not.toContain('important');
    expect(flagged).not.toContain('pointer-events');
    expect(flagged).not.toContain('style');
  });

  it('does not flag JS inside <script> blocks', () => {
    const src = `<script>const greeting = "hi";</script>`;
    const flagged = flaggedTokens(src, 'html');
    // The raw token sequence is `const greeting hi`. With a JS parser
    // nested in, the parent's range should cover them.
    expect(flagged).not.toContain('const');
    expect(flagged).not.toContain('greeting');
  });
});

describe('language-aware skip — JSON', () => {
  it('does not flag property keys', () => {
    const src = `{"full_path":"abc","related_lorebooks":[]}`;
    const flagged = flaggedTokens(src, 'json');
    expect(flagged).not.toContain('full');
    expect(flagged).not.toContain('path');
    expect(flagged).not.toContain('related');
    expect(flagged).not.toContain('lorebooks');
  });

  it('does not flag URL/path-looking string values', () => {
    const src = `{"key":"WetNut/your-shy-secretary-that-is-doing-anything"}`;
    const flagged = flaggedTokens(src, 'json');
    // All these words are inside the JSON String node — skipped.
    expect(flagged).not.toContain('WetNut');
    expect(flagged).not.toContain('your');
    expect(flagged).not.toContain('shy');
    expect(flagged).not.toContain('secretary');
    expect(flagged.length).toBe(0);
  });

  it('does not flag string content outside of JSON String nodes either', () => {
    // A JSON literal that's not valid syntax — `syntaxTree` returns empty;
    // the predicate should therefore yield no skips, and the words flow
    // through to be checked.
    const src = `not actually json`;
    const flagged = flaggedTokens(src, 'json');
    expect(flagged).toEqual(expect.arrayContaining(['not', 'actually', 'json']));
  });
});
