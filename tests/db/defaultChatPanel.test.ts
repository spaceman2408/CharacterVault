import { describe, expect, it } from 'vitest';
import { normalizeDefaultChatPanel } from '../../src/db/characterTypes';

describe('normalizeDefaultChatPanel', () => {
  it('defaults missing values to Orion', () => {
    expect(normalizeDefaultChatPanel(undefined)).toBe('orion');
    expect(normalizeDefaultChatPanel('orion')).toBe('orion');
    expect(normalizeDefaultChatPanel('nope')).toBe('orion');
  });

  it('accepts Agent', () => {
    expect(normalizeDefaultChatPanel('agent')).toBe('agent');
  });
});
