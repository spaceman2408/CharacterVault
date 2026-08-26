import { useCallback, useState, type ReactElement } from 'react';
import { ExternalLink, FlaskConical, X } from 'lucide-react';

const STAGING_URL = 'https://staging.charactervault.app';
const STORAGE_KEY = 'characterVaultStagingPromoDismissed';
const STAGING_HOST = 'staging.charactervault.app';

function shouldShow(): boolean {
  try {
    if (window.location.hostname === STAGING_HOST) return false;
    return localStorage.getItem(STORAGE_KEY) !== 'true';
  } catch {
    return false;
  }
}

export function StagingPromoBanner(): ReactElement | null {
  const [visible, setVisible] = useState(shouldShow);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Try upcoming features on staging"
      className="relative overflow-hidden bg-accent text-accent-fg"
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent" />
      <div className="relative mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6 lg:px-8">
        <FlaskConical className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden />
        <p className="min-w-0 flex-1 text-xs font-medium leading-snug sm:text-sm">
          Try new features before they release.
          <span className="hidden sm:inline"> Preview them on the staging site.</span>
        </p>
        <a
          href={STAGING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-fg px-2.5 py-1 text-xs font-semibold text-accent transition-opacity hover:opacity-90"
        >
          Open staging
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1 text-accent-fg/70 transition-colors hover:bg-accent-fg/15 hover:text-accent-fg"
          title="Dismiss"
          aria-label="Dismiss staging preview banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
