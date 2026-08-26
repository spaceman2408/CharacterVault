import { describe, expect, it } from 'vitest';
import { formatAgentBusyLabel } from '../../../src/agent/ui/busyLabel';

describe('formatAgentBusyLabel', () => {
  it('maps known tools to English labels', () => {
    expect(formatAgentBusyLabel('update_field')).toBe('Updating field');
    expect(formatAgentBusyLabel('add_entry')).toBe('Adding entry');
  });

  it('falls back to spaced snake_case', () => {
    expect(formatAgentBusyLabel('brand_new_tool')).toBe('brand new tool');
  });
});
