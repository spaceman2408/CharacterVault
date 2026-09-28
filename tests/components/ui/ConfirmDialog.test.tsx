// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog';

afterEach(cleanup);

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
