/**
 * @fileoverview Reusable sandboxed preview pane for Creator Notes HTML/CSS content.
 * @module components/editor/CreatorNotesPreviewPane
 */

import React from 'react';

interface CreatorNotesPreviewPaneProps {
  content: string;
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
  style,
  frameClassName = '',
  emptyClassName = '',
}: CreatorNotesPreviewPaneProps): React.ReactElement {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const isLoadedRef = React.useRef(false);
  const deferredContent = React.useDeferredValue(content);
  const bodyContent = React.useMemo(() => buildBodyContent(deferredContent), [deferredContent]);

  // Update the iframe body content when deferred content changes
  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !isLoadedRef.current) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.body.innerHTML = bodyContent;
  }, [bodyContent]);

  if (!content.trim()) {
    return (
      <div className={emptyClassName || 'rounded-xl border border-dashed border-border-strong bg-muted/70 px-5 py-6 text-sm text-fg-muted border-border bg-muted text-fg-muted'}>
        Add CSS or HTML to Creator Notes to preview it here.
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title="Creator Notes Preview"
      sandbox="allow-same-origin"
      srcDoc={SKELETON_DOC}
      className={frameClassName}
      style={style}
      onLoad={() => {
        isLoadedRef.current = true;
        const iframe = iframeRef.current;
        if (iframe?.contentDocument) {
          iframe.contentDocument.body.innerHTML = bodyContent;
        }
      }}
    />
  );
}

export default CreatorNotesPreviewPane;
