import { describe, expect, it } from 'vitest';
import { compareSnapshotTimeline } from '../../src/utils/snapshotTimeline';

describe('compareSnapshotTimeline', () => {
  it('keeps the opened baseline last even when newer autos exist', () => {
    const items = [
      { id: 'open', source: 'open' as const, createdAt: '2026-04-01T17:20:00.000Z' },
      { id: 'new-auto', source: 'auto' as const, createdAt: '2026-04-01T17:46:00.000Z' },
      { id: 'old-auto', source: 'auto' as const, createdAt: '2026-04-01T17:19:00.000Z' },
    ];

    expect([...items].sort(compareSnapshotTimeline).map((item) => item.id)).toEqual([
      'new-auto',
      'old-auto',
      'open',
    ]);
  });

  it('orders opened duplicates newest-first among themselves so the last is the oldest', () => {
    const items = [
      { id: 'open-new', source: 'open' as const, createdAt: '2026-04-01T18:00:00.000Z' },
      { id: 'manual', source: 'manual' as const, createdAt: '2026-04-01T17:30:00.000Z' },
      { id: 'open-old', source: 'open' as const, createdAt: '2026-04-01T16:00:00.000Z' },
    ];

    expect([...items].sort(compareSnapshotTimeline).map((item) => item.id)).toEqual([
      'manual',
      'open-new',
      'open-old',
    ]);
  });
});
