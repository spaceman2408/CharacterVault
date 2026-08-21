import type { SnapshotSource } from '../db/characterTypes';

export function compareSnapshotTimeline(
  left: { source: SnapshotSource; createdAt: string },
  right: { source: SnapshotSource; createdAt: string },
): number {
  const leftOpen = left.source === 'open' ? 1 : 0;
  const rightOpen = right.source === 'open' ? 1 : 0;
  if (leftOpen !== rightOpen) return leftOpen - rightOpen;
  return right.createdAt.localeCompare(left.createdAt);
}
