/**
 * @fileoverview Reusable sandboxed preview pane for Creator Notes HTML/CSS content.
 * @module components/editor/CreatorNotesPreviewPane
 */

import React from 'react';

interface CreatorNotesPreviewPaneProps {
  content: string;
  className?: string;
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

function buildCreatorNotesPreviewDoc(content: string): string {
  const trimmedContent = content.trim();
  const containsMarkup = /<[^>]+>/.test(trimmedContent);
  const bodyContent = containsMarkup
    ? trimmedContent
    : `<pre class="creator-notes-plain">${escapeHtml(content)}</pre>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: dark;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        background:
          radial-gradient(circle at top, rgba(71, 85, 105, 0.2), transparent 42%),
          linear-gradient(180deg, #0f172a 0%, #111827 100%);
        color: #e2e8f0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      body {
        padding: 16px;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }

      .creator-notes-plain {
        margin: 0;
        white-space: pre-wrap;
        font: 500 14px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: inherit;
      }
    </style>
  </head>
  <body>${bodyContent}</body>
</html>`;
}

export function CreatorNotesPreviewPane({
  content,
  className = '',
  frameClassName = '',
  emptyClassName = '',
}: CreatorNotesPreviewPaneProps): React.ReactElement {
  const previewDocument = React.useMemo(() => buildCreatorNotesPreviewDoc(content), [content]);

  if (!content.trim()) {
    return (
      <div className={emptyClassName || 'rounded-xl border border-dashed border-vault-300 bg-vault-50/70 px-5 py-6 text-sm text-vault-500 dark:border-vault-700 dark:bg-vault-900/40 dark:text-vault-400'}>
        Add CSS or HTML to Creator Notes to preview it here.
      </div>
    );
  }

  return (
    <div className={className}>
      <iframe
        title="Creator Notes Preview"
        sandbox=""
        srcDoc={previewDocument}
        className={frameClassName}
      />
    </div>
  );
}

export default CreatorNotesPreviewPane;
