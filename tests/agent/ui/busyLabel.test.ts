import { describe, expect, it } from 'vitest';
import type { LorebookEntry } from '../../../src/db/characterTypes';
import { formatAgentBusyLabel } from '../../../src/agent/ui/busyLabel';

function label(toolName: string, headers: Record<string, string> = {}, entries?: LorebookEntry[]) {
  return formatAgentBusyLabel({ toolName, headers }, entries);
}

const ENTRIES = [
  { id: 4, name: 'Harbor', keys: ['harbor'], content: '' },
  { id: 7, name: '', keys: ['keep', 'castle'], content: '' },
] as LorebookEntry[];

describe('formatAgentBusyLabel', () => {
  it('names the field by its label', () => {
    expect(label('update_field', { id: 'description' })).toBe('Updating Description');
    expect(label('replace_in_field', { id: 'first_mes' })).toBe('Replacing in First Message');
    expect(label('read_field', { id: 'nope' })).toBe('Reading field');
  });

  it('names greetings by their 1-based index', () => {
    expect(label('update_greeting', { index: '2' })).toBe('Updating greeting 2');
    expect(label('move_greeting', { index: '3', to: '1' })).toBe('Moving greeting 3 to 1');
    expect(label('delete_greeting', { index: 'last' })).toBe('Deleting greeting');
    expect(label('add_greeting')).toBe('Adding greeting');
  });

  it('names entries from the book, falling back to the id', () => {
    expect(label('read_entry', { id: '4' }, ENTRIES)).toBe('Reading entry “Harbor”');
    expect(label('update_entry', { id: '7' }, ENTRIES)).toBe('Updating entry “keep”');
    expect(label('delete_entry', { id: '12' }, ENTRIES)).toBe('Deleting entry #12');
    expect(label('replace_in_entry', {})).toBe('Replacing in entry');
  });

  it('names a new entry from its name or first key', () => {
    expect(label('add_entry', { name: 'Harbor', keys: 'harbor' })).toBe('Adding entry “Harbor”');
    expect(label('add_entry', { keys: 'docks, pier' })).toBe('Adding entry “docks”');
    expect(label('add_entry')).toBe('Adding entry');
  });

  it('quotes and clips the search query', () => {
    expect(label('search', { query: 'harbor' })).toBe('Searching “harbor”');
    expect(label('search', { query: 'a'.repeat(60) })).toBe(`Searching “${'a'.repeat(39)}…”`);
    expect(label('search')).toBe('Searching');
  });

  it('keeps plain labels for tools without a target', () => {
    expect(label('list_entries')).toBe('Listing entries');
    expect(label('audit_card')).toBe('Auditing card');
  });

  it('falls back to spaced snake_case', () => {
    expect(label('brand_new_tool')).toBe('brand new tool');
  });
});
