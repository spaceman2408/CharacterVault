/**
 * @fileoverview Reusable sandboxed preview pane for Creator Notes HTML/CSS content.
 * @module components/editor/CreatorNotesPreviewPane
 */

import React from 'react';
import { hasRemoteReference } from '../../utils/creatorNotesRemote';

type SillyTavernRenderer = typeof import('../../utils/creatorNotesRender').renderCreatorNotesLikeSillyTavern;

let sillyTavernRendererPromise: Promise<SillyTavernRenderer> | null = null;

function loadSillyTavernRenderer(): Promise<SillyTavernRenderer> {
  sillyTavernRendererPromise ??= import('../../utils/creatorNotesRender').then(
    (module) => module.renderCreatorNotesLikeSillyTavern,
  );
  return sillyTavernRendererPromise;
}

interface CreatorNotesPreviewPaneProps {
  content: string;
  charName: string;
  matchSillyTavern: boolean;
  onMatchSillyTavernChange: (value: boolean) => void;
  showRemoteWarning?: boolean;
  style?: React.CSSProperties;
  frameClassName?: string;
  emptyClassName?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildBodyContent(content: string): string {
  const trimmedContent = content.trim();
  const containsMarkup = /<[^>]+>/.test(trimmedContent);
  return containsMarkup
    ? trimmedContent
    : `<pre class="creator-notes-plain">${escapeHtml(content)}</pre>`;
}

const SKELETON_DOC = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https:; img-src data: blob: https:; font-src data: https:" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        background: #1f2937;
        color: #e2e8f0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body { padding: 16px; line-height: 1.5; overflow-wrap: anywhere; }
      #creator_notes_spoiler { font-size: 12px; padding: 5px 0; }
      #creator_notes_spoiler p:last-child { margin-bottom: 0; }
      .creator-notes-plain {
        margin: 0; white-space: pre-wrap;
        font: 500 14px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: inherit;
      }
    </style>
  </head>
  <body></body>
</html>`;

export function CreatorNotesPreviewPane({
  content,
  charName,
  matchSillyTavern,
  onMatchSillyTavernChange,
  showRemoteWarning = true,
  style,
  frameClassName = '',
  emptyClassName = '',
}: CreatorNotesPreviewPaneProps): React.ReactElement {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const isLoadedRef = React.useRef(false);
  const deferredContent = React.useDeferredValue(content);
  const [renderSillyTavern, setRenderSillyTavern] = React.useState<SillyTavernRenderer | null>(null);

  React.useEffect(() => {
    if (!matchSillyTavern || renderSillyTavern) return;
    let cancelled = false;
    void loadSillyTavernRenderer().then((render) => {
      if (!cancelled) setRenderSillyTavern(() => render);
    });
    return () => {
      cancelled = true;
    };
  }, [matchSillyTavern, renderSillyTavern]);

  const { bodyContent, notices } = React.useMemo(() => {
    if (!matchSillyTavern) return { bodyContent: buildBodyContent(deferredContent), notices: [] };
    if (!renderSillyTavern) return { bodyContent: '', notices: [] };
    return renderSillyTavern(deferredContent, { charName });
  }, [deferredContent, matchSillyTavern, charName, renderSillyTavern]);

  // Update the iframe body content when deferred content changes
  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !isLoadedRef.current) return;
    const doc = iframe.contentDocument;
    // Only the srcdoc document has the CSP. After the pane was empty, the remounted
    // iframe still holds its initial about:blank until the srcdoc loads.
    if (!doc || doc.URL !== 'about:srcdoc') return;
    doc.body.innerHTML = bodyContent;
  }, [bodyContent]);

  const hasRemote = React.useMemo(
    () => showRemoteWarning && hasRemoteReference(bodyContent),
    [showRemoteWarning, bodyContent],
  );

  if (!content.trim()) {
    return (
      <div className={emptyClassName || 'rounded-xl border-dashed px-5 py-6 text-sm border-border bg-muted text-fg-muted'}>
        Add CSS or HTML to Creator Notes to preview it here.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface px-3 py-2 text-xs">
        <label className="inline-flex cursor-pointer items-center gap-2 text-fg-muted">
          <button
            type="button"
            role="switch"
            aria-checked={matchSillyTavern}
            onClick={() => onMatchSillyTavernChange(!matchSillyTavern)}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${matchSillyTavern ? 'bg-accent' : 'bg-border-strong'}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-transform ${
                matchSillyTavern ? 'translate-x-4' : ''
              }`}
            />
          </button>
          Match SillyTavern
        </label>
        {notices.length > 0 && (
          <ul aria-label="Changes in SillyTavern" className="flex flex-wrap gap-1.5">
            {notices.map((notice) => (
              <li key={notice} className="rounded-md bg-warning-soft px-2 py-0.5 text-warning-soft-fg">
                {notice}
              </li>
            ))}
          </ul>
        )}
      </div>
      {hasRemote && (
        <div
          role="note"
          className="shrink-0 border-b border-warning/40 bg-warning-soft px-4 py-2 text-xs text-warning-soft-fg"
        >
          These notes load images, fonts, or styles from other websites. Those sites can see
          your IP address and that you opened this card. Scripts never run. Turn this warning
          off in Settings → Character Workspace.
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Creator Notes Preview"
        sandbox="allow-same-origin"
        srcDoc={SKELETON_DOC}
        className={`min-h-0 flex-1 ${frameClassName}`}
        style={style}
        onLoad={() => {
          isLoadedRef.current = true;
          const iframe = iframeRef.current;
          if (iframe?.contentDocument) {
            iframe.contentDocument.body.innerHTML = bodyContent;
          }
        }}
      />
    </div>
  );
}

export default CreatorNotesPreviewPane;
