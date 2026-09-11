/**
 * @fileoverview Tests for the shared editor basics extension factory.
 */

import { describe, it, expect } from 'vitest';
import { editorBasics } from '../../src/editor/extensions/editorBasics';

describe('editorBasics', () => {
  it('returns base behaviors without a placeholder', () => {
    const extensions = editorBasics();
    expect(extensions.length).toBeGreaterThan(0);
  });

  it('adds one more extension when placeholder text is provided', () => {
    const without = editorBasics();
    const withPlaceholder = editorBasics({ placeholderText: 'Write...' });
    expect(withPlaceholder.length).toBe(without.length + 1);
  });
});
