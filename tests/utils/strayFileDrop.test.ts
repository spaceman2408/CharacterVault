import { describe, expect, it, vi } from 'vitest';
import { blockStrayFileDrop } from '../../src/utils/strayFileDrop';

function dragEvent(types: string[], defaultPrevented = false, target: object | null = null) {
  const event = {
    defaultPrevented,
    target,
    dataTransfer: { types, dropEffect: 'copy' },
    preventDefault: vi.fn(),
  };
  return event;
}

describe('blockStrayFileDrop', () => {
  it('cancels an unhandled file drag and refuses the drop', () => {
    const event = dragEvent(['Files']);
    blockStrayFileDrop(event as unknown as DragEvent);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.dataTransfer.dropEffect).toBe('none');
  });

  it('leaves a drag that a drop target already handled', () => {
    const event = dragEvent(['Files'], true);
    blockStrayFileDrop(event as unknown as DragEvent);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.dataTransfer.dropEffect).toBe('copy');
  });

  it('leaves a file drag over an editor so it can take the file natively', () => {
    const event = dragEvent(['Files'], false, { isContentEditable: true });
    blockStrayFileDrop(event as unknown as DragEvent);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.dataTransfer.dropEffect).toBe('copy');
  });

  it('leaves text and element drags alone', () => {
    const event = dragEvent(['text/plain']);
    blockStrayFileDrop(event as unknown as DragEvent);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
