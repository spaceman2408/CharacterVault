/**
 * @fileoverview Reusable sandboxed preview pane for Creator Notes HTML/CSS content.
 * @module components/editor/CreatorNotesPreviewPane
 */

import React from 'react';
import { Grid2x2, Maximize2, Monitor, Moon, PanelRight, RotateCcw, Smartphone, Sun } from 'lucide-react';
import { hasRemoteReference } from '../../utils/creatorNotesRemote';
import {
  CREATOR_NOTES_PREVIEW_WIDTHS,
  type CreatorNotesPreviewBackdrop,
  type CreatorNotesPreviewPrefs,
  type CreatorNotesPreviewWidth,
} from './useCreatorNotesPreviewPrefs';

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
  prefs: CreatorNotesPreviewPrefs;
  onPrefsChange: (patch: Partial<CreatorNotesPreviewPrefs>) => void;
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

// Backdrop rules use :where() so the notes' own html/body styles still win.
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
      :where(html[data-backdrop="light"]) { color-scheme: light; }
      :where(html[data-backdrop="light"]), :where(html[data-backdrop="light"]) body {
        background: #f8fafc;
        color: #1e293b;
      }
      :where(html[data-backdrop="checker"]), :where(html[data-backdrop="checker"]) body {
        background: repeating-conic-gradient(#2b3544 0% 25%, #1f2937 0% 50%) 0 0 / 20px 20px;
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

const WIDTH_OPTIONS: Array<{ value: CreatorNotesPreviewWidth; label: string; icon: React.ElementType }> = [
  { value: 'full', label: 'Full width', icon: Maximize2 },
  { value: 'wide', label: `Wide (${CREATOR_NOTES_PREVIEW_WIDTHS.wide}px)`, icon: Monitor },
  { value: 'panel', label: `SillyTavern panel (${CREATOR_NOTES_PREVIEW_WIDTHS.panel}px)`, icon: PanelRight },
  { value: 'phone', label: `Phone (${CREATOR_NOTES_PREVIEW_WIDTHS.phone}px)`, icon: Smartphone },
];

const BACKDROP_OPTIONS: Array<{ value: CreatorNotesPreviewBackdrop; label: string; icon: React.ElementType }> = [
  { value: 'dark', label: 'Dark background', icon: Moon },
  { value: 'light', label: 'Light background', icon: Sun },
  { value: 'checker', label: 'Checkerboard background', icon: Grid2x2 },
];

function PreviewSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}): React.ReactElement {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-fg-muted">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-border-strong'}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
      {label}
    </label>
  );
}

function IconChoice<T extends string>({
  label,
  options,
  value,
  onChange,
  className = '',
}: {
  label: string;
  options: Array<{ value: T; label: string; icon: React.ElementType }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}): React.ReactElement {
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-lg border border-border p-0.5 ${className}`}>
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => {
        const selected = optionValue === value;
        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={optionLabel}
            title={optionLabel}
            onClick={() => onChange(optionValue)}
            className={`rounded-md p-1.5 transition-colors ${
              selected ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-hover hover:text-fg'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

export function CreatorNotesPreviewPane({
  content,
  charName,
  prefs,
  onPrefsChange,
  showRemoteWarning = true,
  style,
  frameClassName = '',
  emptyClassName = '',
}: CreatorNotesPreviewPaneProps): React.ReactElement {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const isLoadedRef = React.useRef(false);
  const deferredContent = React.useDeferredValue(content);
  const [renderSillyTavern, setRenderSillyTavern] = React.useState<SillyTavernRenderer | null>(null);
  const { matchSillyTavern, allowRemoteMedia, width, backdrop } = prefs;

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
    return renderSillyTavern(deferredContent, { charName, allowExternalMedia: allowRemoteMedia });
  }, [deferredContent, matchSillyTavern, charName, renderSillyTavern, allowRemoteMedia]);

  const getFrameDocument = React.useCallback((): Document | null => {
    const doc = iframeRef.current?.contentDocument;
    // Only the srcdoc document has the CSP. After the pane was empty, the remounted
    // iframe still holds its initial about:blank until the srcdoc loads.
    if (!isLoadedRef.current || !doc || doc.URL !== 'about:srcdoc') return null;
    return doc;
  }, []);

  React.useEffect(() => {
    const doc = getFrameDocument();
    if (doc) doc.body.innerHTML = bodyContent;
  }, [bodyContent, getFrameDocument]);

  React.useEffect(() => {
    const doc = getFrameDocument();
    if (doc) doc.documentElement.setAttribute('data-backdrop', backdrop);
  }, [backdrop, getFrameDocument]);

  const replay = () => {
    const doc = getFrameDocument();
    if (doc) doc.body.innerHTML = bodyContent;
  };

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

  const frameWidth = CREATOR_NOTES_PREVIEW_WIDTHS[width];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface px-3 py-2 text-xs">
        <PreviewSwitch
          label="Match SillyTavern"
          checked={matchSillyTavern}
          onChange={(value) => onPrefsChange({ matchSillyTavern: value })}
        />
        {matchSillyTavern && (
          <PreviewSwitch
            label="Remote media"
            checked={allowRemoteMedia}
            onChange={(value) => onPrefsChange({ allowRemoteMedia: value })}
          />
        )}
        <div className="ml-auto flex items-center gap-2">
          <IconChoice
            label="Preview width"
            options={WIDTH_OPTIONS}
            value={width}
            onChange={(value) => onPrefsChange({ width: value })}
            className="max-sm:hidden"
          />
          <IconChoice
            label="Preview background"
            options={BACKDROP_OPTIONS}
            value={backdrop}
            onChange={(value) => onPrefsChange({ backdrop: value })}
          />
          <button
            type="button"
            onClick={replay}
            aria-label="Replay animations"
            title="Replay animations"
            className="rounded-lg border border-border p-2 text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        {notices.length > 0 && (
          <ul aria-label="Changes in SillyTavern" className="flex w-full flex-wrap gap-1.5">
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
      <div className={`min-h-0 flex-1 overflow-hidden ${frameWidth ? 'bg-muted py-3' : ''}`}>
        <iframe
          ref={iframeRef}
          title="Creator Notes Preview"
          sandbox="allow-same-origin"
          srcDoc={SKELETON_DOC}
          className={`mx-auto block h-full max-w-full ${frameClassName}`}
          style={{ ...style, width: frameWidth ? `${frameWidth}px` : '100%' }}
          onLoad={(event) => {
            isLoadedRef.current = true;
            const doc = event.currentTarget.contentDocument;
            if (doc) {
              doc.documentElement.setAttribute('data-backdrop', backdrop);
              doc.body.innerHTML = bodyContent;
            }
          }}
        />
      </div>
    </div>
  );
}

export default CreatorNotesPreviewPane;
