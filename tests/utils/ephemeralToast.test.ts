// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showEphemeralToast } from '../../src/utils/ephemeralToast';

const HOST = '#cv-ephemeral-toast-host';

describe('showEphemeralToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('removes itself and its host after the duration', () => {
    showEphemeralToast({ title: 'Saved', durationMs: 1000 });
    expect(document.querySelector(HOST)?.childElementCount).toBe(1);
    vi.advanceTimersByTime(1200);
    expect(document.querySelector(HOST)).toBeNull();
  });

  it('runs the action once and dismisses the toast', () => {
    const onClick = vi.fn();
    showEphemeralToast({ title: 'Replaced', action: { label: 'Undo', onClick } });
    const button = [...document.querySelectorAll(`${HOST} button`)].find((b) => b.textContent === 'Undo') as HTMLButtonElement;
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(250);
    expect(document.querySelector(HOST)).toBeNull();
  });

  it('returns a dismiss that is safe to call more than once and cancels the auto-dismiss timer', () => {
    const dismiss = showEphemeralToast({ title: 'Replaced', durationMs: 8000 });
    dismiss();
    dismiss();
    vi.advanceTimersByTime(250);
    expect(document.querySelector(HOST)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});
