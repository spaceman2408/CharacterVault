import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { ExportCheckFinding, ExportCheckTarget } from '../../services/exportChecklist';

const MAX_ROWS = 8;

interface ExportChecklistDialogProps {
  characterName: string;
  findings: ExportCheckFinding[];
  onExport: () => void;
  onCancel: () => void;
  onGoTo?: (target: ExportCheckTarget) => void;
  onOpenCard?: () => void;
}

export function ExportChecklistDialog({
  characterName,
  findings,
  onExport,
  onCancel,
  onGoTo,
  onOpenCard,
}: ExportChecklistDialogProps): React.ReactElement {
  const onCancelRef = React.useRef(onCancel);

  React.useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  React.useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCancelRef.current();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, []);

  const shown = findings.slice(0, MAX_ROWS);
  const hidden = findings.length - shown.length;
  const title = `Before you export ${characterName.trim() || 'this character'}`;

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl"
      >
        <h2 className="text-base font-semibold text-fg wrap-break-word">{title}</h2>
        <ul className="mt-3 flex flex-col gap-1">
          {shown.map((finding) => (
            <li key={finding.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-fg">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span className="min-w-0 flex-1 wrap-break-word">{finding.message}</span>
              {onGoTo && (
                <button
                  type="button"
                  onClick={() => onGoTo(finding.target)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft"
                >
                  Go to
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
          {hidden > 0 && <li className="px-2 py-1 text-xs text-fg-muted">+{hidden} more</li>}
        </ul>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            Cancel
          </button>
          {onOpenCard && (
            <button
              type="button"
              onClick={onOpenCard}
              className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-fg transition-colors hover:bg-hover"
            >
              Open card
            </button>
          )}
          <button
            type="button"
            onClick={onExport}
            autoFocus
            className="rounded-xl border bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90"
          >
            Export anyway
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
