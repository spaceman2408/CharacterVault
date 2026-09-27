import type { ReactElement } from 'react';
import { ShieldCheck } from 'lucide-react';

export function AgentReviewStatus({
  requireReview,
  pendingCount,
  onOpen,
}: {
  requireReview: boolean;
  pendingCount: number | null;
  onOpen: () => void;
}): ReactElement | null {
  if (pendingCount != null) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-warning-soft px-2 py-1 text-xs font-medium text-warning-soft-fg"
        title={`${pendingCount} agent edit${pendingCount === 1 ? '' : 's'} waiting for review`}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Review {pendingCount}
      </button>
    );
  }
  if (!requireReview) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-lg bg-accent-soft p-1.5 text-accent"
      title="Agent edits need your review before they are applied (Studio settings)"
      aria-label="Review required"
      role="img"
    >
      <ShieldCheck className="h-3.5 w-3.5" />
    </span>
  );
}
