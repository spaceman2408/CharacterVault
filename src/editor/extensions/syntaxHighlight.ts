/**
 * Shared CodeMirror syntax highlighting from CSS theme tokens.
 * Colors are resolved from --syntax-* variables on documentElement so
 * light/dark (and any palette edit in index.css) stay single-source.
 */

import type { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const SYNTAX_VARS = {
  keyword: '--syntax-keyword',
  string: '--syntax-string',
  comment: '--syntax-comment',
  tag: '--syntax-tag',
  attribute: '--syntax-attribute',
  number: '--syntax-number',
  punctuation: '--syntax-punctuation',
  variable: '--syntax-variable',
  type: '--syntax-type',
  property: '--syntax-property',
  operator: '--syntax-operator',
  meta: '--syntax-meta',
} as const;

const FALLBACKS: Record<keyof typeof SYNTAX_VARS, string> = {
  keyword: '#7c3aed',
  string: '#059669',
  comment: '#94a3b8',
  tag: '#7c3aed',
  attribute: '#2563eb',
  number: '#d97706',
  punctuation: '#6b7280',
  variable: '#db2777',
  type: '#e11d48',
  property: '#0891b2',
  operator: '#6b7280',
  meta: '#94a3b8',
};

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function resolveSyntaxColors(): Record<keyof typeof SYNTAX_VARS, string> {
  return {
    keyword: cssVar(SYNTAX_VARS.keyword, FALLBACKS.keyword),
    string: cssVar(SYNTAX_VARS.string, FALLBACKS.string),
    comment: cssVar(SYNTAX_VARS.comment, FALLBACKS.comment),
    tag: cssVar(SYNTAX_VARS.tag, FALLBACKS.tag),
    attribute: cssVar(SYNTAX_VARS.attribute, FALLBACKS.attribute),
    number: cssVar(SYNTAX_VARS.number, FALLBACKS.number),
    punctuation: cssVar(SYNTAX_VARS.punctuation, FALLBACKS.punctuation),
    variable: cssVar(SYNTAX_VARS.variable, FALLBACKS.variable),
    type: cssVar(SYNTAX_VARS.type, FALLBACKS.type),
    property: cssVar(SYNTAX_VARS.property, FALLBACKS.property),
    operator: cssVar(SYNTAX_VARS.operator, FALLBACKS.operator),
    meta: cssVar(SYNTAX_VARS.meta, FALLBACKS.meta),
  };
}

export function createSyntaxHighlightStyle(): HighlightStyle {
  const c = resolveSyntaxColors();
  return HighlightStyle.define([
    { tag: tags.keyword, color: c.keyword },
    { tag: tags.string, color: c.string },
    { tag: tags.comment, color: c.comment, fontStyle: 'italic' },
    { tag: tags.tagName, color: c.tag },
    { tag: tags.attributeName, color: c.attribute },
    { tag: tags.attributeValue, color: c.string },
    { tag: tags.number, color: c.number },
    { tag: tags.unit, color: c.number },
    { tag: tags.color, color: c.number },
    { tag: tags.className, color: c.number },
    { tag: tags.labelName, color: c.number },
    { tag: tags.angleBracket, color: c.punctuation },
    { tag: tags.punctuation, color: c.punctuation },
    { tag: tags.bracket, color: c.punctuation },
    { tag: tags.separator, color: c.punctuation },
    { tag: tags.operator, color: c.operator },
    { tag: tags.variableName, color: c.variable },
    { tag: tags.definition(tags.variableName), color: c.attribute },
    { tag: tags.typeName, color: c.type },
    { tag: tags.propertyName, color: c.property },
    { tag: tags.meta, color: c.meta },
    { tag: tags.processingInstruction, color: c.keyword },
  ]);
}

export function syntaxHighlightExtension(): Extension {
  return syntaxHighlighting(createSyntaxHighlightStyle());
}
