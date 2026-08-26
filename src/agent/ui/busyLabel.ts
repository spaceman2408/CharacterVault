const BUSY_LABELS: Record<string, string> = {
  list_fields: 'Listing fields',
  read_field: 'Reading field',
  update_field: 'Updating field',
  replace_in_field: 'Replacing in field',
  append_to_field: 'Appending to field',
  list_greetings: 'Listing greetings',
  read_greeting: 'Reading greeting',
  add_greeting: 'Adding greeting',
  update_greeting: 'Updating greeting',
  replace_in_greeting: 'Replacing in greeting',
  delete_greeting: 'Deleting greeting',
  move_greeting: 'Moving greeting',
  list_entries: 'Listing entries',
  read_entry: 'Reading entry',
  add_entry: 'Adding entry',
  update_entry: 'Updating entry',
  replace_in_entry: 'Replacing in entry',
  delete_entry: 'Deleting entry',
  search: 'Searching',
  replace_across: 'Replacing across',
  audit_card: 'Auditing card',
  audit_book: 'Auditing book',
  read_recursion: 'Reading recursion',
  update_book_settings: 'Updating book settings',
};

export function formatAgentBusyLabel(toolName: string): string {
  return BUSY_LABELS[toolName] ?? toolName.replace(/_/g, ' ');
}
