// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLeaveWarning } from '../../../src/agent/ui/useLeaveWarning';

function leave(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('useLeaveWarning', () => {
  it('asks to confirm leaving only while active', () => {
    const { rerender, unmount } = renderHook(({ active }) => useLeaveWarning(active), {
      initialProps: { active: false },
    });
    expect(leave()).toBe(false);
    rerender({ active: true });
    expect(leave()).toBe(true);
    rerender({ active: false });
    expect(leave()).toBe(false);
    rerender({ active: true });
    unmount();
    expect(leave()).toBe(false);
  });
});
