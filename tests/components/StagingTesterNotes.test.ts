import { describe, it, expect } from 'vitest';
import {
  isStagingHost,
  shouldShowStagingNotes,
  STAGING_HOST,
} from '../../src/stagingNotes';

describe('isStagingHost', () => {
  it('matches the staging host only', () => {
    expect(isStagingHost(STAGING_HOST)).toBe(true);
    expect(isStagingHost('vault.charactervault.app')).toBe(false);
    expect(isStagingHost('localhost')).toBe(false);
  });

  it('allows a preview override for local testing', () => {
    expect(isStagingHost('localhost', '?stagingNotes=1')).toBe(true);
    expect(isStagingHost('localhost', '', '#/?stagingNotes=1')).toBe(true);
    expect(isStagingHost('localhost', '?other=1')).toBe(false);
  });
});

describe('shouldShowStagingNotes', () => {
  it('shows when the version has not been seen', () => {
    expect(shouldShowStagingNotes(null, 'v2')).toBe(true);
    expect(shouldShowStagingNotes('v1', 'v2')).toBe(true);
  });

  it('hides once the current version is dismissed', () => {
    expect(shouldShowStagingNotes('v2', 'v2')).toBe(false);
  });
});
