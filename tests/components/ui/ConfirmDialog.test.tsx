// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog';

afterEach(cleanup);

describe('ConfirmDialog placement', () => {
  it('renders on the document body so a blurred parent cannot clip the overlay', () => {
    const { container } = render(
      <div style={{ backdropFilter: 'blur(24px)' }}>
        <ConfirmDialog open title="Reset?" message="Sure?" onConfirm={() => undefined} onCancel={() => undefined} />
      </div>,
    );
    const dialog = document.querySelector('[role="alertdialog"]');

    expect(dialog).not.toBeNull();
    expect(container.contains(dialog)).toBe(false);
  });
});

describe('ConfirmDialog Escape', () => {
  it('cancels the dialog without reaching an Escape listener underneath', () => {
    const parentClose = vi.fn();
    document.addEventListener('keydown', parentClose);
    const onCancel = vi.fn();

    try {
      render(
        <ConfirmDialog open title="Reset?" message="Sure?" onConfirm={() => undefined} onCancel={onCancel} />,
      );
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(parentClose).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', parentClose);
    }
  });

  it('leaves Escape alone while closed', () => {
    const parentClose = vi.fn();
    document.addEventListener('keydown', parentClose);
    const onCancel = vi.fn();

    try {
      render(
        <ConfirmDialog open={false} title="Reset?" message="Sure?" onConfirm={() => undefined} onCancel={onCancel} />,
      );
      fireEvent.keyDown(document.body, { key: 'Escape' });

      expect(onCancel).not.toHaveBeenCalled();
      expect(parentClose).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('keydown', parentClose);
    }
  });
});
