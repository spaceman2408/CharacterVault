import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { FlaskConical, X } from 'lucide-react';
import { STAGING_TEST_NOTES, STAGING_VERSION, isStagingHost, shouldShowStagingNotes } from '../stagingNotes';

const STORAGE_KEY = 'characterVaultStagingNotesSeen';

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

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, STAGING_VERSION);
    } catch {
      // ignore
    }
    setOpen(false);
  }, []);

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
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-surface px-3 py-2 text-xs font-semibold text-accent shadow-lg transition-colors hover:bg-accent-soft"
        title={`Staging test notes (${STAGING_VERSION})`}
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
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
