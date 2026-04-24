/**
 * @fileoverview HTML entity normalization helpers for CodeMirror editors.
 * @module @editor/extensions/normalizeHtmlEntities
 */

import { EditorView } from '@codemirror/view';

const HTML_ENTITY_PATTERN = /&(?:#\d+|#x[\da-f]+|[a-z][\w-]*);/gi;

function decodeHtmlEntity(entity: string): string {
  if (typeof document === 'undefined') {
    return entity;
  }

  const textarea = document.createElement('textarea');
  textarea.innerHTML = entity;
  return textarea.value || entity;
}

export function normalizeHtmlEntities(value: string): string {
  return value.replace(HTML_ENTITY_PATTERN, entity => decodeHtmlEntity(entity));
}

export function normalizeHtmlEntitiesInView(view: EditorView): boolean {
  const selection = view.state.selection.main;
  const hasSelection = selection.from !== selection.to;
  const from = hasSelection ? selection.from : 0;
  const to = hasSelection ? selection.to : view.state.doc.length;
  const currentValue = view.state.doc.sliceString(from, to);
  const normalizedValue = normalizeHtmlEntities(currentValue);

  if (normalizedValue === currentValue) {
    return false;
  }

  view.dispatch({
    changes: {
      from,
      to,
      insert: normalizedValue,
    },
    selection: hasSelection
      ? { anchor: from, head: from + normalizedValue.length }
      : { anchor: Math.min(selection.anchor, normalizedValue.length), head: Math.min(selection.head, normalizedValue.length) },
  });

  return true;
}
