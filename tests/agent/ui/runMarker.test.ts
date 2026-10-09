// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clearRunMarker, readRunMarker, writeRunMarker } from '../../../src/agent/ui/runMarker';

const thread = { ownerType: 'character' as const, ownerId: 'c1', panel: 'agent' as const };
const other = { ...thread, ownerId: 'c2' };

beforeEach(() => {
  localStorage.clear();
});

describe('run marker', () => {
  it('is kept per thread until cleared', () => {
    writeRunMarker(thread, { reviewWaiting: false });
    expect(readRunMarker(thread)).toEqual({ reviewWaiting: false });
    expect(readRunMarker(other)).toBeNull();
    clearRunMarker(thread);
    expect(readRunMarker(thread)).toBeNull();
  });

  it('survives the end of the run while a review is waiting', () => {
    writeRunMarker(thread, { reviewWaiting: true });
    clearRunMarker(thread, { keepReview: true });
    expect(readRunMarker(thread)).toEqual({ reviewWaiting: true });
    clearRunMarker(thread);
    expect(readRunMarker(thread)).toBeNull();
  });

  it('ends a run with no review', () => {
    writeRunMarker(thread, { reviewWaiting: false });
    clearRunMarker(thread, { keepReview: true });
    expect(readRunMarker(thread)).toBeNull();
  });

  it('does nothing without an owner', () => {
    const none = { ...thread, ownerId: '' };
    writeRunMarker(none, { reviewWaiting: false });
    expect(localStorage.length).toBe(0);
    expect(readRunMarker(none)).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(() => writeRunMarker(thread, { reviewWaiting: false }, broken)).not.toThrow();
    expect(readRunMarker(thread, broken)).toBeNull();
    expect(() => clearRunMarker(thread, { keepReview: true }, broken)).not.toThrow();
  });
});
