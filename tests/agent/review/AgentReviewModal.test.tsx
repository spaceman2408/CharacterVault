// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AgentReviewModal } from '../../../src/agent/review/AgentReviewModal';
import type { AgentReviewChange } from '../../../src/agent/review/types';

beforeAll(() => {
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

const changes: AgentReviewChange[] = [
  { id: 'field:description', kind: 'field', fieldId: 'description', label: 'Description', before: 'One two three.', after: 'One two four.' },
  { id: 'field:scenario', kind: 'field', fieldId: 'scenario', label: 'Scenario', before: 'Calm.', after: 'Calm and kind.' },
];

function renderModal() {
  render(
    <AgentReviewModal
      changes={changes}
      isApplying={false}
      onApply={vi.fn()}
      onDiscard={vi.fn()}
      onMinimize={vi.fn()}
    />,
  );
}

function row(label: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`(Expand|Collapse) ${label}$`) }).closest('article') as HTMLElement;
}

describe('AgentReviewModal', () => {
  it('shows word counts on collapsed rows and the diff only on open ones', () => {
    renderModal();

    expect(within(row('Description')).getByText('Original')).toBeTruthy();
    expect(within(row('Scenario')).getByText('+2')).toBeTruthy();
    expect(within(row('Scenario')).queryByText('Original')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expand Scenario' }));
    expect(within(row('Scenario')).getByText('Original')).toBeTruthy();
  });

  it('hides the diff while editing or denied, and keeps the counts', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Edit proposed Description' }));
    expect(within(row('Description')).queryByText('Original')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Edited Description' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Stop editing Description' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deny Description' }));
    expect(within(row('Description')).queryByText('Original')).toBeNull();
    expect(within(row('Description')).getByText('+1')).toBeTruthy();
  });
});
