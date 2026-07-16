/**
 * @fileoverview In-editor AI ghost preview decorations.
 * Hides the locked selection range and shows AI output as a glowing ghost
 * without mutating the document until Accept.
 *
 * Uses inline (non-block) replace decorations so the ghost starts exactly at
 * the selection anchor — a true 1:1 preview of the Accept edit, including when
 * the selection starts mid-line / mid-paragraph.
 * @module @editor/extensions/aiGhostPreview
 */

import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import type { EditorState } from '@codemirror/state';

export interface AIGhostPreviewData {
  from: number;
  to: number;
  content: string;
  isStreaming: boolean;
}

/** Set or clear the full ghost preview (null clears). */
export const setAIGhostPreview = StateEffect.define<AIGhostPreviewData | null>();

/** Update ghost text / streaming flag without changing the range. */
export const updateAIGhostPreview = StateEffect.define<
  Partial<Pick<AIGhostPreviewData, 'content' | 'isStreaming'>>
>();

/** Convenience clear effect (same as setAIGhostPreview.of(null)). */
export const clearAIGhostPreview = StateEffect.define<null>();

class AIGhostWidget extends WidgetType {
  private content: string;
  private isStreaming: boolean;

  constructor(content: string, isStreaming: boolean) {
    super();
    this.content = content;
    this.isStreaming = isStreaming;
  }

  eq(other: AIGhostWidget): boolean {
    return this.content === other.content && this.isStreaming === other.isStreaming;
  }

  toDOM(): HTMLElement {
    // Inline span so the ghost begins at the selection start on the same line
    // as the unselected prefix (true 1:1 replace preview).
    const wrap = document.createElement('span');
    wrap.className = this.isStreaming
      ? 'cm-ai-ghost-preview cm-ai-ghost-preview--streaming'
      : 'cm-ai-ghost-preview';
    wrap.setAttribute('aria-hidden', 'true');
    this.writeContent(wrap);
    return wrap;
  }

  /**
   * Reuse the existing DOM node when content streams in so the CSS pulse
   * animation is not reset on every token (which made the pulse invisible).
   */
  updateDOM(dom: HTMLElement): boolean {
    if (!(dom instanceof HTMLElement) || !dom.classList.contains('cm-ai-ghost-preview')) {
      return false;
    }
    dom.className = this.isStreaming
      ? 'cm-ai-ghost-preview cm-ai-ghost-preview--streaming'
      : 'cm-ai-ghost-preview';
    this.writeContent(dom);
    return true;
  }

  private writeContent(wrap: HTMLElement): void {
    // No streaming caret — the editor caret is enough (two carets looked broken).
    const text = this.content.length > 0 ? this.content : this.isStreaming ? '…' : '';
    wrap.textContent = text;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function clampGhost(data: AIGhostPreviewData, docLength: number): AIGhostPreviewData {
  const from = Math.max(0, Math.min(data.from, docLength));
  const to = Math.max(from, Math.min(data.to, docLength));
  return { ...data, from, to };
}

/**
 * Build decorations that preview the Accept edit in-place.
 *
 * Always uses an **inline** replace/widget (never CM block widgets) so a
 * mid-line selection does not leave a blank stub on the first line while the
 * ghost drops to a full-width card below.
 *
 * Multi-line selections are still one replace range; the widget uses
 * pre-wrap so newlines in the AI output flow naturally from the selection start.
 */
function buildGhostDecorations(state: EditorState, ghost: AIGhostPreviewData | null): DecorationSet {
  if (!ghost) return Decoration.none;

  const { from, to, content, isStreaming } = clampGhost(ghost, state.doc.length);
  const widget = new AIGhostWidget(content, isStreaming);

  if (from === to) {
    return Decoration.set([
      Decoration.widget({
        widget,
        side: 1,
        block: false,
        atomic: true,
      }).range(from),
    ]);
  }

  // Inline replace for every range — including multi-line — so the ghost is a
  // 1:1 stand-in for the text Accept will write at `from`.
  return Decoration.set([
    Decoration.replace({
      widget,
      block: false,
    }).range(from, to),
  ]);
}

/**
 * Holds ghost preview metadata; range is mapped through document changes.
 */
export const aiGhostPreviewField = StateField.define<AIGhostPreviewData | null>({
  create() {
    return null;
  },
  update(value, tr) {
    let next = value;

    for (const effect of tr.effects) {
      if (effect.is(setAIGhostPreview)) {
        next = effect.value;
      } else if (effect.is(clearAIGhostPreview)) {
        next = null;
      } else if (effect.is(updateAIGhostPreview) && next) {
        next = { ...next, ...effect.value };
      }
    }

    if (next && tr.docChanged) {
      const from = tr.changes.mapPos(next.from, 1);
      const to = tr.changes.mapPos(next.to, -1);
      next = {
        ...next,
        from: Math.min(from, to),
        to: Math.max(from, to),
      };
    }

    if (next) {
      next = clampGhost(next, tr.state.doc.length);
    }

    return next;
  },
});

/**
 * Extension: ghost state field + decorations derived from it.
 */
export function aiGhostPreview() {
  return [
    aiGhostPreviewField,
    EditorView.decorations.compute([aiGhostPreviewField], (state) =>
      buildGhostDecorations(state, state.field(aiGhostPreviewField)),
    ),
  ];
}
