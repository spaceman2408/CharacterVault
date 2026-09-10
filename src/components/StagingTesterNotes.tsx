import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { FlaskConical, X } from 'lucide-react';
import { STAGING_TEST_NOTES, STAGING_VERSION, isStagingHost, shouldShowStagingNotes } from '../stagingNotes';

const STORAGE_KEY = 'characterVaultStagingNotesSeen';
const POS_STORAGE_KEY = 'characterVaultStagingNotesPos';
const DRAG_THRESHOLD_PX = 5;
const EDGE_MARGIN_PX = 8;

interface NotesButtonPos {
  left: number;
  top: number;
}

function readStoredPos(): NotesButtonPos | null {
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { left, top } = parsed as Partial<NotesButtonPos>;
    if (typeof left !== 'number' || typeof top !== 'number') return null;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    return { left, top };
  } catch {
    return null;
  }
}

function readSeenVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function StagingTesterNotes(): ReactElement | null {
  const [isStaging] = useState(() => {
    try {
      return isStagingHost(window.location.hostname, window.location.search, window.location.hash);
    } catch {
      return false;
    }
  });
  const [open, setOpen] = useState(() => shouldShowStagingNotes(readSeenVersion(), STAGING_VERSION));
  const [pos, setPos] = useState<NotesButtonPos | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const didDragRef = useRef(false);

  const clampPos = useCallback((left: number, top: number): NotesButtonPos => {
    if (typeof window === 'undefined') return { left, top };
    const button = buttonRef.current;
    const width = button?.offsetWidth ?? 120;
    const height = button?.offsetHeight ?? 36;
    const maxLeft = Math.max(EDGE_MARGIN_PX, window.innerWidth - width - EDGE_MARGIN_PX);
    const maxTop = Math.max(EDGE_MARGIN_PX, window.innerHeight - height - EDGE_MARGIN_PX);
    return {
      left: Math.min(Math.max(EDGE_MARGIN_PX, left), maxLeft),
      top: Math.min(Math.max(EDGE_MARGIN_PX, top), maxTop),
    };
  }, []);

  useEffect(() => {
    const stored = readStoredPos();
    if (stored === null) return;
    const frame = requestAnimationFrame(() => {
      setPos(clampPos(stored.left, stored.top));
    });
    return () => cancelAnimationFrame(frame);
  }, [clampPos]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setPos((prev) => {
        if (prev === null) return prev;
        const button = buttonRef.current;
        const width = button?.offsetWidth ?? 120;
        const height = button?.offsetHeight ?? 36;
        const maxLeft = Math.max(EDGE_MARGIN_PX, window.innerWidth - width - EDGE_MARGIN_PX);
        const maxTop = Math.max(EDGE_MARGIN_PX, window.innerHeight - height - EDGE_MARGIN_PX);
        const clamped = {
          left: Math.min(Math.max(EDGE_MARGIN_PX, prev.left), maxLeft),
          top: Math.min(Math.max(EDGE_MARGIN_PX, prev.top), maxTop),
        };
        return clamped.left === prev.left && clamped.top === prev.top ? prev : clamped;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, STAGING_VERSION);
    } catch {
      // ignore
    }
    setOpen(false);
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.isPrimary === false) return;
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: pos?.left ?? rect.left,
      startTop: pos?.top ?? rect.top,
    };
    didDragRef.current = false;
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }, [pos]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      didDragRef.current = true;
    }
    if (didDragRef.current) {
      setPos(clampPos(drag.startLeft + dx, drag.startTop + dy));
    }
  }, [clampPos]);

  const endDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    try {
      buttonRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    if (didDragRef.current) {
      setPos((prev) => {
        if (prev === null) return prev;
        try {
          localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(prev));
        } catch {
          // ignore
        }
        return prev;
      });
    }
  }, []);

  const handleButtonClick = useCallback(() => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    setOpen(true);
  }, []);

  const handleResetPos = useCallback(() => {
    didDragRef.current = false;
    dragRef.current = null;
    setPos(null);
    try {
      localStorage.removeItem(POS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    handleResetPos();
  }, [handleResetPos]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismiss]);

  if (!isStaging) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleButtonClick}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={pos !== null ? { left: pos.left, top: pos.top, touchAction: 'none' } : { touchAction: 'none' }}
        className={`fixed z-40 inline-flex cursor-grab items-center gap-1.5 rounded-full border border-accent/30 bg-surface px-3 py-2 text-xs font-semibold text-accent shadow-lg transition-colors select-none hover:bg-accent-soft active:cursor-grabbing ${pos !== null ? '' : 'bottom-4 right-4'}`}
        title={`Staging test notes (${STAGING_VERSION}) — drag to move, right-click to reset`}
        aria-label="Open staging test notes"
      >
        <FlaskConical className="h-3.5 w-3.5" aria-hidden />
        Test notes
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-end justify-center sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staging-notes-title"
          >
            <button
              type="button"
              className="absolute inset-0 bg-overlay backdrop-blur-sm"
              aria-label="Close test notes"
              onClick={dismiss}
            />
            <div className="relative w-full max-w-md rounded-t-2xl border border-border bg-surface p-4 shadow-2xl sm:mx-4 sm:rounded-2xl sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="staging-notes-title" className="flex items-center gap-2 text-sm font-semibold text-fg">
                    <FlaskConical className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                    Staging test notes
                  </h2>
                  <p className="mt-1 inline-block rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                    {STAGING_VERSION}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-accent-soft hover:text-accent"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {STAGING_TEST_NOTES.length === 0 ? (
                <p className="mt-3 text-sm text-fg-muted italic">No specific test requests right now.</p>
              ) : (
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-fg">
                  {STAGING_TEST_NOTES.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={dismiss}
                className="mt-4 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90"
              >
                Got it
              </button>
              {pos !== null && (
                <button
                  type="button"
                  onClick={handleResetPos}
                  className="mt-2 w-full rounded-xl px-4 py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-accent-soft hover:text-accent"
                >
                  Reset floating button position
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
