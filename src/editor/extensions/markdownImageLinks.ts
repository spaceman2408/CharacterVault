/**
 * @fileoverview CodeMirror extension: highlight Markdown image syntax and
 * optionally open the URL after a leave-app safety warning.
 *
 * @module editor/extensions/markdownImageLinks
 */

import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { Compartment, type Extension, type Range } from '@codemirror/state';
import {
  findMarkdownImages,
  formatUrlForDisplay,
  isOpenableHttpUrl,
} from '../markdownImage/findMarkdownImages';

export interface MarkdownImageLinksOptions {
  /** When false, highlight still applies but clicks do not open. */
  openLinksEnabled: boolean;
}

const markdownImageOpenLinksCompartment = new Compartment();

const MARK_CLASS = 'cm-md-image';
const URL_CLASS = 'cm-md-image-url';
const OPENABLE_CLASS = 'cm-md-image-openable';

const CLICK_DRAG_PX = 5;

let activeModal: HTMLElement | null = null;
let activeModalKeydown: ((event: KeyboardEvent) => void) | null = null;

function dismissExternalLinkModal(): void {
  if (activeModalKeydown) {
    document.removeEventListener('keydown', activeModalKeydown, true);
    activeModalKeydown = null;
  }
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
  }
}

function openExternalUrl(url: string): void {
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (win) win.opener = null;
}

function showLeaveConfirmModal(url: string): void {
  if (!isOpenableHttpUrl(url)) return;
  dismissExternalLinkModal();

  const { host, truncated } = formatUrlForDisplay(url);

  const overlay = document.createElement('div');
  overlay.className = 'cv-external-link-overlay';
  overlay.setAttribute('role', 'presentation');

  const dialog = document.createElement('div');
  dialog.className = 'cv-external-link-dialog';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'cv-external-link-title');
  dialog.setAttribute('aria-describedby', 'cv-external-link-desc');

  const header = document.createElement('div');
  header.className = 'cv-external-link-header';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'cv-external-link-eyebrow';
  eyebrow.textContent = 'External link';

  const title = document.createElement('h2');
  title.id = 'cv-external-link-title';
  title.className = 'cv-external-link-title';
  title.textContent = 'Leaving CharacterVault';

  const desc = document.createElement('p');
  desc.id = 'cv-external-link-desc';
  desc.className = 'cv-external-link-desc';
  desc.textContent =
    'You are about to open an external website. This can be dangerous. Only continue if you trust the source.';

  const urlBox = document.createElement('div');
  urlBox.className = 'cv-external-link-url';
  if (host) {
    const hostEl = document.createElement('div');
    hostEl.className = 'cv-external-link-host';
    hostEl.textContent = host;
    urlBox.appendChild(hostEl);
  }
  const fullEl = document.createElement('div');
  fullEl.className = 'cv-external-link-full';
  fullEl.textContent = truncated;
  urlBox.appendChild(fullEl);

  const actions = document.createElement('div');
  actions.className = 'cv-external-link-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cv-external-link-cancel';
  cancelBtn.textContent = 'Cancel';

  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'cv-external-link-confirm';
  openBtn.textContent = 'Open link';

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dismissExternalLinkModal();
    }
  };

  cancelBtn.addEventListener('click', (event) => {
    event.preventDefault();
    dismissExternalLinkModal();
  });
  openBtn.addEventListener('click', (event) => {
    event.preventDefault();
    openExternalUrl(url);
    dismissExternalLinkModal();
  });
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) dismissExternalLinkModal();
  });

  header.appendChild(eyebrow);
  header.appendChild(title);
  dialog.appendChild(header);
  dialog.appendChild(desc);
  dialog.appendChild(urlBox);
  actions.appendChild(cancelBtn);
  actions.appendChild(openBtn);
  dialog.appendChild(actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  activeModal = overlay;
  activeModalKeydown = onKeyDown;
  document.addEventListener('keydown', onKeyDown, true);
  openBtn.focus();
}

function findOpenableImageAt(
  view: EditorView,
  pos: number,
): { url: string; from: number; to: number } | null {
  if (pos < 0 || pos > view.state.doc.length) return null;
  const line = view.state.doc.lineAt(pos);
  for (const match of findMarkdownImages(line.text)) {
    const from = line.from + match.from;
    const to = line.from + match.to;
    // Half-open [from, to): empty space after the link must not match.
    if (pos >= from && pos < to && isOpenableHttpUrl(match.url)) {
      return { url: match.url, from, to };
    }
  }
  return null;
}

/** True only when the pointer is over the decorated link text, not empty line padding. */
function isEventOnOpenableImageMark(event: MouseEvent): boolean {
  const raw = event.target;
  const el =
    raw instanceof Element ? raw : raw instanceof Text ? raw.parentElement : null;
  if (!el) return false;
  return Boolean(el.closest(`.${OPENABLE_CLASS}`));
}

function buildImageDecorations(view: EditorView, openLinksEnabled: boolean): DecorationSet {
  const ranges: Range<Decoration>[] = [];

  for (const { from: rangeFrom, to: rangeTo } of view.visibleRanges) {
    const startLine = view.state.doc.lineAt(rangeFrom);
    const endLine = view.state.doc.lineAt(rangeTo);

    for (let lineNo = startLine.number; lineNo <= endLine.number; lineNo += 1) {
      const line = view.state.doc.line(lineNo);
      for (const match of findMarkdownImages(line.text)) {
        const from = line.from + match.from;
        const to = line.from + match.to;
        const urlFrom = line.from + match.urlFrom;
        const urlTo = line.from + match.urlTo;
        const openable = openLinksEnabled && isOpenableHttpUrl(match.url);
        const markClass = openable ? `${MARK_CLASS} ${OPENABLE_CLASS}` : MARK_CLASS;

        ranges.push(Decoration.mark({ class: markClass }).range(from, to));
        if (urlFrom < urlTo && urlFrom >= from && urlTo <= to) {
          ranges.push(
            Decoration.mark({
              class: openable ? `${URL_CLASS} ${OPENABLE_CLASS}` : URL_CLASS,
            }).range(urlFrom, urlTo),
          );
        }
      }
    }
  }

  return Decoration.set(ranges, true);
}

function imageLinksPlugin(openLinksEnabled: boolean) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      down: { x: number; y: number; pos: number } | null = null;

      constructor(view: EditorView) {
        this.decorations = buildImageDecorations(view, openLinksEnabled);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.geometryChanged) {
          this.decorations = buildImageDecorations(update.view, openLinksEnabled);
        }
      }

      destroy() {
        this.down = null;
        dismissExternalLinkModal();
      }
    },
    {
      decorations: (value) => value.decorations,
      eventHandlers: {
        mousedown(event, view) {
          if (!openLinksEnabled || event.button !== 0) {
            this.down = null;
            return false;
          }
          // posAtCoords maps empty line gutter/padding to a nearby doc pos, so
          // require the event target to be the marked link text (same as hover).
          if (!isEventOnOpenableImageMark(event)) {
            this.down = null;
            return false;
          }
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos == null || !findOpenableImageAt(view, pos)) {
            this.down = null;
            return false;
          }
          this.down = { x: event.clientX, y: event.clientY, pos };
          return false;
        },
        click(event, view) {
          if (!openLinksEnabled || event.button !== 0 || !this.down) return false;

          const dx = event.clientX - this.down.x;
          const dy = event.clientY - this.down.y;
          const dragged = dx * dx + dy * dy > CLICK_DRAG_PX * CLICK_DRAG_PX;
          const down = this.down;
          this.down = null;
          if (dragged) return false;
          if (!isEventOnOpenableImageMark(event)) return false;

          const pos =
            view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? down.pos;
          const match = findOpenableImageAt(view, pos);
          if (!match) return false;

          event.preventDefault();
          showLeaveConfirmModal(match.url);
          return true;
        },
      },
    },
  );
}

function makeBaseTheme(): Extension {
  return EditorView.baseTheme({
    [`.${MARK_CLASS}`]: {
      borderRadius: '2px',
      backgroundColor: 'color-mix(in srgb, var(--accent, #7c3aed) 12%, transparent)',
    },
    [`.${URL_CLASS}`]: {
      color: 'var(--syntax-string, #059669)',
      textDecoration: 'underline',
      textDecorationColor: 'color-mix(in srgb, var(--syntax-string, #059669) 45%, transparent)',
      textUnderlineOffset: '2px',
    },
    [`.${OPENABLE_CLASS}`]: {
      cursor: 'pointer',
    },
    [`.${OPENABLE_CLASS}:hover`]: {
      backgroundColor: 'color-mix(in srgb, var(--accent, #7c3aed) 20%, transparent)',
    },
  });
}

function injectModalStylesOnce(): void {
  const id = 'cv-external-link-modal-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
.cv-external-link-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: max(0.75rem, env(safe-area-inset-top, 0px))
    max(0.75rem, env(safe-area-inset-right, 0px))
    max(0.75rem, env(safe-area-inset-bottom, 0px))
    max(0.75rem, env(safe-area-inset-left, 0px));
  background: var(--overlay, rgba(30, 18, 51, 0.4));
  backdrop-filter: blur(4px);
}
@media (min-width: 640px) {
  .cv-external-link-overlay {
    align-items: center;
    padding: 1.5rem;
  }
}
.cv-external-link-dialog {
  width: 100%;
  max-width: 28rem;
  border-radius: 1rem;
  border: 1px solid var(--border, rgba(0,0,0,0.12));
  background: var(--surface, #fff);
  color: var(--fg, #1e1233);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  padding: 1.25rem;
}
.cv-external-link-eyebrow {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-muted, #5b5270);
}
.cv-external-link-title {
  margin: 0.35rem 0 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--fg, #1e1233);
}
.cv-external-link-desc {
  margin: 0.75rem 0 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--fg-muted, #5b5270);
}
.cv-external-link-url {
  margin-top: 0.85rem;
  padding: 0.65rem 0.75rem;
  border-radius: 0.5rem;
  background: var(--muted, rgba(0,0,0,0.04));
  border: 1px solid var(--border, rgba(0,0,0,0.08));
  word-break: break-all;
}
.cv-external-link-host {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--fg, #1e1233);
  margin-bottom: 0.2rem;
}
.cv-external-link-full {
  font-size: 0.75rem;
  color: var(--fg-muted, #5b5270);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.cv-external-link-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.15rem;
}
.cv-external-link-cancel,
.cv-external-link-confirm {
  min-height: 2.75rem;
  padding: 0.55rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
}
.cv-external-link-cancel {
  background: transparent;
  border-color: var(--border, rgba(0,0,0,0.12));
  color: var(--fg, #1e1233);
}
.cv-external-link-cancel:hover {
  background: var(--hover, rgba(0,0,0,0.04));
}
.cv-external-link-confirm {
  background: var(--danger, #dc2626);
  color: #fff;
}
.cv-external-link-confirm:hover {
  filter: brightness(1.05);
}
.cv-external-link-confirm:focus-visible,
.cv-external-link-cancel:focus-visible {
  outline: 2px solid var(--accent, #7c3aed);
  outline-offset: 2px;
}
`;
  document.head.appendChild(style);
}

function buildEnabledExtensions(openLinksEnabled: boolean): Extension[] {
  return [imageLinksPlugin(openLinksEnabled)];
}

export function markdownImageLinks(
  options: MarkdownImageLinksOptions = { openLinksEnabled: true },
): Extension {
  injectModalStylesOnce();
  return [
    makeBaseTheme(),
    markdownImageOpenLinksCompartment.of(buildEnabledExtensions(options.openLinksEnabled)),
  ];
}

export function setMarkdownImageOpenLinks(view: EditorView, openLinksEnabled: boolean): void {
  view.dispatch({
    effects: markdownImageOpenLinksCompartment.reconfigure(
      buildEnabledExtensions(openLinksEnabled),
    ),
  });
}
