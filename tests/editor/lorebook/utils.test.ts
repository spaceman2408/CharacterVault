import { describe, expect, it } from 'vitest';
import { createBlankLorebookEntry, hasNonDefaultOptions } from '../../../src/components/editor/lorebook/utils';

describe('hasNonDefaultOptions', () => {
  it('is false for a blank entry', () => {
    expect(hasNonDefaultOptions(createBlankLorebookEntry(0))).toBe(false);
  });

  it('is true when activation, matching, or placement differ from defaults', () => {
    const base = createBlankLorebookEntry(1);
    expect(hasNonDefaultOptions({ ...base, excludeRecursion: true })).toBe(true);
    expect(hasNonDefaultOptions({ ...base, selective: true })).toBe(true);
    expect(hasNonDefaultOptions({ ...base, position: 'at_depth' })).toBe(true);
    expect(hasNonDefaultOptions({ ...base, priority: 10 })).toBe(true);
    expect(hasNonDefaultOptions({ ...base, case_sensitive: true })).toBe(true);
    expect(hasNonDefaultOptions({ ...base, name: 'memo' })).toBe(true);
  });
});
