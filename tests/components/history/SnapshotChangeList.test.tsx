// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SnapshotDiffEntry } from '../../../src/db/characterTypes';
import { SnapshotChangeList } from '../../../src/components/history/SnapshotChangeList';
import { buildSnapshotChangeGroups } from '../../../src/components/history/snapshotChanges';

beforeAll(() => {
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

function diffEntry(section: SnapshotDiffEntry['section'], label: string, snapshotValue: unknown, currentValue: unknown): SnapshotDiffEntry {
  return { section, label, changed: true, snapshotValue, currentValue };
}

function card(label: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`(Expand|Collapse) ${label}$`) }).closest('article') as HTMLElement;
}

describe('SnapshotChangeList', () => {
  const entries = [
    diffEntry('description', 'Description', 'One two three.', 'One two four.'),
    diffEntry('personality', 'Personality', 'Calm.', 'Calm and kind.'),
    diffEntry('lorebook', 'Lorebook', { extensions: {}, entries: [], description: '' }, { extensions: {}, entries: [], description: 'x'.repeat(80) }),
  ];

  function renderList(onRestore = vi.fn()) {
    render(
      <SnapshotChangeList
        groups={buildSnapshotChangeGroups(entries)}
        activeSection="description"
        restoreDisabled={false}
        onRestore={onRestore}
      />,
    );
    return onRestore;
  }

  it('opens the active section and shows word counts on collapsed cards', () => {
    renderList();

    expect(within(card('Description')).getByText('Revision')).toBeTruthy();
    const personality = card('Personality');
    expect(within(personality).getByText('+2')).toBeTruthy();
    expect(within(personality).queryByText('Revision')).toBeNull();
  });

  it('renders the diff only while a card is open', () => {
    renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Expand Personality' }));
    expect(within(card('Personality')).getByText('Revision')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Personality' }));
    expect(within(card('Personality')).queryByText('Revision')).toBeNull();
  });

  it('shows long book settings as a diff', () => {
    renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Expand Book settings' }));
    expect(within(card('Book settings')).getByText('Description')).toBeTruthy();
    expect(within(card('Book settings')).getByText('Revision')).toBeTruthy();
  });

  it('restores a field from its card and a lorebook from its heading', () => {
    const onRestore = renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Restore Personality' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore Lorebook' }));

    expect(onRestore.mock.calls.map(([entry]) => entry.section)).toEqual(['personality', 'lorebook']);
  });
});
