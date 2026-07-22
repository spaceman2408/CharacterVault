import { describe, expect, it, vi } from 'vitest';
import {
  openHistoryAfterFlush,
  shouldComputePayloadHash,
} from '../../src/services/historyLifecycle';

describe('openHistoryAfterFlush', () => {
  it('flushes before opening the modal', async () => {
    const order: string[] = [];
    const flush = vi.fn(async () => {
      order.push('flush');
    });
    const setOpen = vi.fn((open: boolean) => {
      order.push(`setOpen:${open}`);
    });

    const opened = await openHistoryAfterFlush({ flush, setOpen });

    expect(opened).toBe(true);
    expect(order).toEqual(['flush', 'setOpen:true']);
  });

  it('does not open when flush throws', async () => {
    const setOpen = vi.fn();
    const opened = await openHistoryAfterFlush({
      flush: async () => {
        throw new Error('save failed');
      },
      setOpen,
    });

    expect(opened).toBe(false);
    expect(setOpen).not.toHaveBeenCalled();
  });

  it('ignores concurrent opens while busy', async () => {
    let resolveFlush: (() => void) | undefined;
    const flush = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveFlush = resolve;
        }),
    );
    const setOpen = vi.fn();
    let isOpening = false;
    const setIsOpening = vi.fn((busy: boolean) => {
      isOpening = busy;
    });

    const first = openHistoryAfterFlush({
      flush,
      setOpen,
      isOpening,
      setIsOpening,
    });

    expect(setIsOpening).toHaveBeenCalledWith(true);
    isOpening = true;

    const second = await openHistoryAfterFlush({
      flush,
      setOpen,
      isOpening,
      setIsOpening,
    });

    expect(second).toBe(false);
    expect(flush).toHaveBeenCalledTimes(1);

    resolveFlush?.();
    await first;

    expect(setOpen).toHaveBeenCalledOnce();
    expect(setOpen).toHaveBeenCalledWith(true);
    expect(setIsOpening).toHaveBeenLastCalledWith(false);
  });
});

describe('shouldComputePayloadHash', () => {
  it('is true only when the history modal is visible', () => {
    expect(shouldComputePayloadHash(true)).toBe(true);
    expect(shouldComputePayloadHash(false)).toBe(false);
  });
});
