/**
 * @fileoverview Sandboxed preview modal for Creator Notes HTML/CSS content.
 * @module components/editor/CreatorNotesPreviewModal
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { CreatorNotesPreviewPane } from './CreatorNotesPreviewPane';

interface CreatorNotesPreviewModalProps {
  content: string;
  isOpen: boolean;
  onClose: () => void;
  onAddToEditor: () => void;
}

const VIEWPORT_PRESETS = [
  { id: 'mobile', label: 'Mobile', width: 390, height: 844 },
  { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
  { id: 'laptop', label: 'Laptop', width: 1366, height: 768 },
  { id: 'desktop', label: 'Desktop', width: 1536, height: 864 },
] as const;

export function CreatorNotesPreviewModal({
  content,
  isOpen,
  onClose,
  onAddToEditor,
}: CreatorNotesPreviewModalProps): React.ReactElement | null {
  const [activePresetId, setActivePresetId] = React.useState<(typeof VIEWPORT_PRESETS)[number]['id']>('laptop');
  const [previewScale, setPreviewScale] = React.useState(1);
  const [availableViewportSize, setAvailableViewportSize] = React.useState({ width: 0, height: 0 });
  const previewViewportRef = React.useRef<HTMLDivElement>(null);
  const activePreset = React.useMemo(
    () => VIEWPORT_PRESETS.find((preset) => preset.id === activePresetId) ?? VIEWPORT_PRESETS[2],
    [activePresetId]
  );
  const viewportWidth = activePreset.width;
  const viewportHeight = activePreset.height;

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (!isOpen) return;

    const container = previewViewportRef.current;
    if (!container) return;

    const updateScale = () => {
      const nextWidth = container.clientWidth;
      const nextHeight = container.clientHeight;
      setAvailableViewportSize({ width: nextWidth, height: nextHeight });

      if (nextWidth === 0 || nextHeight === 0) {
        setPreviewScale(1);
        return;
      }

      setPreviewScale(Math.min(1, nextWidth / viewportWidth));
    };

    updateScale();

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });

    resizeObserver.observe(container);
    window.addEventListener('resize', updateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [isOpen, viewportWidth, viewportHeight]);

  if (!isOpen) return null;

  const modalWidth = `min(${viewportWidth + 140}px, 95vw)`;
  const modalHeight = `min(${viewportHeight + 220}px, 90vh)`;
  const scaledViewportWidth = viewportWidth * previewScale;
  const scaledViewportHeight = Math.min(availableViewportSize.height || viewportHeight, viewportHeight * previewScale);
  const shouldShowViewportHint =
    availableViewportSize.width > 0 &&
    availableViewportSize.height > 0 &&
    previewScale < 0.999;

  return createPortal(
    <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 flex min-h-135 min-w-[320px] max-h-[90vh] max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-vault-200 bg-white shadow-2xl dark:border-vault-700 dark:bg-vault-900"
        style={{
          width: modalWidth,
          height: modalHeight,
          resize: 'both',
        }}
      >
        <div className="flex items-center justify-between gap-4 border-b border-vault-200 px-5 py-4 dark:border-vault-800">
          <div>
            <h3 className="text-lg font-semibold text-vault-900 dark:text-vault-50">
              Creator Notes Preview
            </h3>
            <p className="text-sm text-vault-500 dark:text-vault-400">
              Live sandboxed preview of your HTML/CSS content.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddToEditor}
              className="rounded-lg bg-vault-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-vault-700 dark:hover:bg-vault-500"
            >
              Add to Editor
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-vault-200 px-3 py-2 text-sm font-medium text-vault-700 transition-colors hover:bg-vault-100 dark:border-vault-700 dark:text-vault-200 dark:hover:bg-vault-800"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-vault-200 px-5 py-3 dark:border-vault-800">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-vault-500 dark:text-vault-400">
            Viewport
          </span>
          <div className="flex flex-wrap gap-2">
            {VIEWPORT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setActivePresetId(preset.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activePresetId === preset.id
                    ? 'bg-vault-600 text-white dark:bg-vault-500'
                    : 'bg-vault-100 text-vault-700 hover:bg-vault-200 dark:bg-vault-800 dark:text-vault-200 dark:hover:bg-vault-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="ml-auto text-sm text-vault-600 dark:text-vault-300">
            <span className="tabular-nums">
              {viewportWidth}px × {viewportHeight}px
            </span>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden bg-vault-950 p-4">
          <div ref={previewViewportRef} className="flex h-full min-h-0 items-start justify-center overflow-hidden">
            <div
              className="flex items-start justify-center overflow-hidden"
              style={{
                width: `${scaledViewportWidth}px`,
                height: `${scaledViewportHeight}px`,
              }}
            >
              <div
                className="rounded-[1.25rem] border border-vault-700 bg-vault-950 shadow-[0_20px_60px_rgba(15,23,42,0.45)]"
                style={{
                  width: `${viewportWidth}px`,
                  height: `${viewportHeight}px`,
                  minWidth: '280px',
                  minHeight: '400px',
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top center',
                }}
              >
                <CreatorNotesPreviewPane
                  content={content}
                  className="h-full rounded-[1.25rem]"
                  frameClassName="block h-full w-full rounded-[1.25rem] bg-vault-950"
                  emptyClassName="flex h-full items-center justify-center rounded-[1.25rem] border border-dashed border-vault-600 bg-vault-950/70 px-5 py-6 text-center text-sm text-vault-300"
                />
              </div>
            </div>
          </div>

          {shouldShowViewportHint && (
            <div className="pointer-events-none absolute right-8 bottom-8 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
              Scaled to fit {Math.round(previewScale * 100)}%
            </div>
          )}
        </div>

        <div className="border-t border-vault-200 px-5 py-2 text-xs text-vault-500 dark:border-vault-800 dark:text-vault-400">
          Preview viewport: {viewportWidth}px × {viewportHeight}px
          {shouldShowViewportHint ? ' • scaled to fit current popup size' : ''}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default CreatorNotesPreviewModal;
