import { describe, expect, it } from 'vitest';
import { canRetryEmptySend } from '../../../src/components/ai/utils';

describe('canRetryEmptySend', () => {
  it('allows empty send when the last message is the user turn', () => {
    expect(
      canRetryEmptySend(
        [
          { role: 'user', content: 'write the description' },
        ],
        true,
      ),
    ).toBe(true);
  });

  it('allows empty send after stop mid-thinking leaves a speech-less assistant', () => {
    expect(
      canRetryEmptySend(
        [
          { role: 'user', content: 'write the description' },
          { role: 'assistant', content: '' },
        ],
        true,
      ),
    ).toBe(true);
  });

  it('does not allow empty send after a finished assistant reply', () => {
    expect(
      canRetryEmptySend(
        [
          { role: 'user', content: 'write the description' },
          { role: 'assistant', content: 'Done.' },
        ],
        true,
      ),
    ).toBe(false);
  });

  it('does not allow empty send with no history or regenerate off', () => {
    expect(canRetryEmptySend([], true)).toBe(false);
    expect(canRetryEmptySend([{ role: 'user', content: 'hi' }], false)).toBe(false);
  });
});
