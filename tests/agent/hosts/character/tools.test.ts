import { describe, expect, it, vi } from 'vitest';
import { createCharacterHost } from '../../../../src/agent/hosts/character/createHost';
import type { CharacterHostPersist } from '../../../../src/agent/hosts/character/createHost';
import { tokenCountLabel } from '../../../../src/agent/hosts/character/catalog';
import {
  addGreeting,
  appendToField,
  auditCard,
  deleteGreeting,
  listFields,
  listGreetings,
  moveGreeting,
  readField,
  readGreeting,
  replaceAcrossCard,
  replaceInField,
  replaceInGreeting,
  searchCard,
  updateField,
  updateGreeting,
} from '../../../../src/agent/hosts/character/tools';
import type { CharacterBook, CharacterSpec } from '../../../../src/db/characterTypes';
import { createEmptyCharacterBook } from '../../../../src/db/characterTypes';

function spec(overrides: Partial<CharacterSpec> = {}): CharacterSpec {
  return {
    name: 'Aria',
    description: 'A cartographer.',
    personality: 'Quiet.',
    scenario: 'A rain-soaked port.',
    first_mes: 'Hello.',
    mes_example: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    physical_description: '',
    ...overrides,
  };
}

function action(name: string, headers: Record<string, string> = {}, body = '') {
  return { name, headers, body };
}

function hostState(card: CharacterSpec = spec(), book: CharacterBook = createEmptyCharacterBook('Aria')) {
  const persist = vi.fn(async (update: CharacterHostPersist) => {
    if (update.spec) card = update.spec;
    if (update.book) book = update.book;
  });
  return {
    get card() {
      return card;
    },
    set card(next: CharacterSpec) {
      card = next;
    },
    get book() {
      return book;
    },
    persist,
    io: {
      getSpec: () => card,
      getBook: () => book,
      persist,
      getCustomContext: async () => null as string | null,
    },
  };
}

describe('listFields', () => {
  it('does not include field bodies', () => {
    const result = listFields(spec({ description: 'SECRET BODY' }));
    expect(result.ok).toBe(true);
    expect(result.message).toContain(`description (Description) — ${tokenCountLabel('SECRET BODY')}`);
    expect(result.message).not.toContain('SECRET BODY');
  });
});

describe('readField', () => {
  it('returns only that field', () => {
    const result = readField(
      spec({ description: 'SECRET BODY', personality: 'OTHER' }),
      action('read_field', { id: 'description' }),
    );
    expect(result.ok).toBe(true);
    expect(result.message).toContain('SECRET BODY');
    expect(result.message).not.toContain('OTHER');
  });

  it('rejects an unknown field', () => {
    const result = readField(spec(), action('read_field', { id: 'lorebook' }));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('unknown field');
    expect(result.message).toContain('description');
  });
});

describe('updateField', () => {
  it('replaces a string field', () => {
    const { spec: next, result, changed } = updateField(
      spec({ description: 'short' }),
      action('update_field', { id: 'description' }, 'A wandering cartographer.'),
    );
    expect(result.ok).toBe(true);
    expect(changed).toBe(true);
    expect(next.description).toBe('A wandering cartographer.');
    expect(result.message).toContain('ok description');
  });

  it('stores tags as an array', () => {
    const { spec: next, result } = updateField(
      spec(),
      action('update_field', { id: 'tags' }, 'fantasy, map, quiet'),
    );
    expect(result.ok).toBe(true);
    expect(next.tags).toEqual(['fantasy', 'map', 'quiet']);
  });
});

describe('replaceInField', () => {
  it('replaces a unique snippet and leaves other fields', () => {
    const { spec: next, result, changed } = replaceInField(
      spec({ description: 'A quiet cartographer.', personality: 'Quiet.' }),
      action('replace_in_field', { id: 'description', old: 'quiet', new: 'careful' }),
    );
    expect(result.ok).toBe(true);
    expect(changed).toBe(true);
    expect(next.description).toBe('A careful cartographer.');
    expect(next.personality).toBe('Quiet.');
    expect(result.message).toContain('replaced 1');
  });

  it('rejects a missing or non-unique snippet', () => {
    const missing = replaceInField(
      spec({ description: 'A cartographer.' }),
      action('replace_in_field', { id: 'description', old: 'knight', new: 'mage' }),
    );
    expect(missing.result.ok).toBe(false);
    expect(missing.result.message).toContain('old not found');

    const dup = replaceInField(
      spec({ description: 'red red fox' }),
      action('replace_in_field', { id: 'description', old: 'red', new: 'blue' }),
    );
    expect(dup.result.ok).toBe(false);
    expect(dup.result.message).toContain('matches 2 times');
  });

  it('replace_all rewrites every match', () => {
    const { spec: next, result } = replaceInField(
      spec({ description: 'red red fox' }),
      action('replace_in_field', {
        id: 'description',
        old: 'red',
        new: 'blue',
        replace_all: 'true',
      }),
    );
    expect(result.ok).toBe(true);
    expect(next.description).toBe('blue blue fox');
    expect(result.message).toContain('replaced 2');
  });
});

describe('greetings', () => {
  it('lists 1-based indexes without bodies', () => {
    const result = listGreetings(
      spec({ alternate_greetings: ['SECRET HELLO', 'OTHER'] }),
    );
    expect(result.message).toContain(`1 — ${tokenCountLabel('SECRET HELLO')}`);
    expect(result.message).toContain(`2 — ${tokenCountLabel('OTHER')}`);
    expect(result.message).not.toContain('SECRET HELLO');
  });

  it('reads, adds, updates, and deletes by 1-based index', () => {
    let card = spec({ alternate_greetings: ['first'] });
    const read = readGreeting(card, action('read_greeting', { index: '1' }));
    expect(read.ok).toBe(true);
    expect(read.message).toContain('greeting 1/1');
    expect(read.message).toContain('first');

    const added = addGreeting(card, action('add_greeting', {}, 'second'));
    expect(added.result.message).toBe('ok greeting 2/2');
    card = added.spec;

    const updated = updateGreeting(
      card,
      action('update_greeting', { index: '1' }, 'revised first'),
    );
    expect(updated.spec.alternate_greetings[0]).toBe('revised first');
    card = updated.spec;

    const deleted = deleteGreeting(card, action('delete_greeting', { index: '1' }));
    expect(deleted.spec.alternate_greetings).toEqual(['second']);
    expect(deleted.result.message).toBe('ok deleted greeting 1; 1 remaining');
  });

  it('replaces a unique snippet in one greeting', () => {
    const { spec: next, result } = replaceInGreeting(
      spec({ alternate_greetings: ['Hello there.', 'Other'] }),
      action('replace_in_greeting', { index: '1', old: 'there', new: 'friend' }),
    );
    expect(result.ok).toBe(true);
    expect(next.alternate_greetings).toEqual(['Hello friend.', 'Other']);
    expect(result.message).toBe('ok greeting 1/2 — replaced 1');
  });

  it('rejects 0 and out-of-range indexes', () => {
    const empty = readGreeting(spec(), action('read_greeting', { index: '1' }));
    expect(empty.ok).toBe(false);
    expect(empty.message).toContain('0 greetings');

    const zero = readGreeting(
      spec({ alternate_greetings: ['first'] }),
      action('read_greeting', { index: '0' }),
    );
    expect(zero.ok).toBe(false);
    expect(zero.message).toContain('indexes start at 1');
  });
});

describe('createCharacterHost', () => {
  it('persists spec once on flush after multiple updates and does not pass the book', async () => {
    const state = hostState();
    const takeSnapshot = vi.fn(async () => undefined);
    const getCustomContext = vi.fn(async () => 'source notes');
    const host = createCharacterHost({
      ...state.io,
      getCustomContext,
      takeSnapshot,
    });

    await host.extraContextChunks();
    await host.extraContextChunks();
    expect(getCustomContext).toHaveBeenCalledTimes(1);

    await host.execute(
      action('update_field', { id: 'description' }, 'Filled description.'),
    );
    await host.execute(
      action('update_field', { id: 'personality' }, 'Calm and exact.'),
    );
    await host.execute(action('add_greeting', {}, 'A second greeting.'));
    expect(state.persist).not.toHaveBeenCalled();
    await host.flush?.();
    expect(takeSnapshot).toHaveBeenCalledTimes(1);
    expect(state.persist).toHaveBeenCalledTimes(1);
    const update = state.persist.mock.calls[0][0];
    expect(update.spec?.description).toBe('Filled description.');
    expect(update.spec?.personality).toBe('Calm and exact.');
    expect(update.spec?.alternate_greetings).toEqual(['A second greeting.']);
    expect(update.book).toBeUndefined();
  });

  it('persists a field snippet replace on flush', async () => {
    const state = hostState(spec({ description: 'A quiet cartographer.' }));
    const host = createCharacterHost(state.io);
    const result = await host.execute(
      action('replace_in_field', { id: 'description', old: 'quiet', new: 'careful' }),
    );
    expect(result.ok).toBe(true);
    expect(state.persist).not.toHaveBeenCalled();
    await host.flush?.();
    expect(state.persist).toHaveBeenCalledTimes(1);
    expect(state.persist.mock.calls[0][0].spec?.description).toBe('A careful cartographer.');
  });

  it('persists spec and embedded book together after mixed writes', async () => {
    const state = hostState();
    const takeSnapshot = vi.fn(async () => undefined);
    const host = createCharacterHost({
      ...state.io,
      takeSnapshot,
    });

    await host.execute(
      action('update_field', { id: 'description' }, 'Filled description.'),
    );
    await host.execute(
      action('add_entry', { name: 'Harbor', keys: 'harbor' }, 'A busy harbor.'),
    );
    expect(state.persist).not.toHaveBeenCalled();
    await host.flush?.();
    expect(takeSnapshot).toHaveBeenCalledTimes(1);
    expect(state.persist).toHaveBeenCalledTimes(1);
    const update = state.persist.mock.calls[0][0];
    expect(update.spec?.description).toBe('Filled description.');
    expect(update.book?.entries).toHaveLength(1);
    expect(update.book?.entries[0].name).toBe('Harbor');
  });

  it('serves cached field reads until update_field', async () => {
    const state = hostState(spec({ description: 'short stub' }));
    const host = createCharacterHost(state.io);

    const firstRead = await host.execute(action('read_field', { id: 'description' }));
    expect(firstRead.message).toContain('short stub');

    state.card = { ...state.card, description: 'MUTATED LIVE SPEC' };
    const cachedRead = await host.execute(action('read_field', { id: 'description' }));
    expect(cachedRead.message).toContain('short stub');
    expect(cachedRead.message).not.toContain('MUTATED LIVE SPEC');

    const updated = await host.execute(
      action('update_field', { id: 'description' }, 'A full description.'),
    );
    expect(updated.ok).toBe(true);
    const afterUpdate = await host.execute(action('read_field', { id: 'description' }));
    expect(afterUpdate.message).toContain('A full description.');
    expect(state.card.description).toBe('MUTATED LIVE SPEC');
    await host.flush?.();
    expect(state.card.description).toBe('A full description.');
  });

  it('drops greeting cache after delete so later indexes are not stale', async () => {
    const state = hostState(spec({ alternate_greetings: ['one', 'two', 'three'] }));
    const host = createCharacterHost(state.io);

    await host.execute(action('read_greeting', { index: '2' }));
    await host.execute(action('delete_greeting', { index: '1' }));
    const after = await host.execute(action('read_greeting', { index: '2' }));
    expect(after.ok).toBe(true);
    expect(after.message).toContain('three');
    expect(after.message).not.toContain('two');
  });

  it('enforces field update and greeting mutation caps', async () => {
    const state = hostState();
    const host = createCharacterHost({
      ...state.io,
      maxFieldUpdates: 1,
      maxGreetingMutations: 1,
    });

    const first = await host.execute(
      action('update_field', { id: 'description' }, 'one'),
    );
    const second = await host.execute(
      action('update_field', { id: 'personality' }, 'two'),
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.message).toContain('limit');

    const add = await host.execute(action('add_greeting', {}, 'hi'));
    const addAgain = await host.execute(action('add_greeting', {}, 'there'));
    expect(add.ok).toBe(true);
    expect(addAgain.ok).toBe(false);
    expect(addAgain.message).toContain('limit');
  });

  it('searches fields and in-run lorebook entries', async () => {
    const state = hostState(spec({ description: 'She keeps maps of the harbor.' }));
    const host = createCharacterHost(state.io);
    await host.execute(action('add_entry', { name: 'Harbor', keys: 'harbor' }, 'A busy harbor.'));
    const found = await host.execute(action('search', { query: 'harbor' }));
    expect(found.ok).toBe(true);
    expect(found.message).toContain('description');
    expect(found.message).toContain('Harbor');
  });

  it('persists replace_across across spec and book on flush', async () => {
    const state = hostState(
      spec({
        description: 'Aria the cartographer.',
        alternate_greetings: ['Hello, Aria.'],
      }),
    );
    const host = createCharacterHost(state.io);
    await host.execute(action('add_entry', { name: 'Aria', keys: 'Aria' }, 'Aria lives at the docks.'));
    const replaced = await host.execute(
      action('replace_across', { old: 'Aria', new: 'Lyra', replace_all: 'true' }),
    );
    expect(replaced.ok).toBe(true);
    expect(state.persist).not.toHaveBeenCalled();
    await host.flush?.();
    expect(state.persist).toHaveBeenCalledTimes(1);
    const update = state.persist.mock.calls[0][0];
    expect(update.spec?.description).toBe('Lyra the cartographer.');
    expect(update.spec?.alternate_greetings).toEqual(['Hello, Lyra.']);
    expect(update.book?.entries[0].content).toContain('Lyra');
    expect(update.book?.entries[0].keys).toEqual(['Lyra']);
  });

  it('does not persist when nothing changed', async () => {
    const state = hostState();
    const takeSnapshot = vi.fn(async () => undefined);
    const host = createCharacterHost({
      ...state.io,
      takeSnapshot,
    });
    await host.execute(action('list_fields'));
    await host.flush?.();
    expect(state.persist).not.toHaveBeenCalled();
    expect(takeSnapshot).not.toHaveBeenCalled();
  });
});

describe('appendToField', () => {
  it('appends with a blank line when the field is not empty', () => {
    const { spec: next, result } = appendToField(
      spec({ personality: 'Quiet.' }),
      action('append_to_field', { id: 'personality' }, 'Keeps a ledger.'),
    );
    expect(result.ok).toBe(true);
    expect(next.personality).toBe('Quiet.\n\nKeeps a ledger.');
  });

  it('merges tags without duplicating', () => {
    const { spec: next } = appendToField(
      spec({ tags: ['map', 'quiet'] }),
      action('append_to_field', { id: 'tags' }, 'quiet, fantasy'),
    );
    expect(next.tags).toEqual(['map', 'quiet', 'fantasy']);
  });
});

describe('moveGreeting', () => {
  it('reorders by 1-based indexes', () => {
    const { spec: next, result } = moveGreeting(
      spec({ alternate_greetings: ['one', 'two', 'three'] }),
      action('move_greeting', { index: '3', to: '1' }),
    );
    expect(result.ok).toBe(true);
    expect(next.alternate_greetings).toEqual(['three', 'one', 'two']);
    expect(result.message).toContain('moved greeting 3 → 1');
  });
});

describe('searchCard', () => {
  it('finds a term in a field and an entry without dumping bodies', () => {
    const card = spec({ description: 'A cartographer of the long southern coast.' });
    const book = createEmptyCharacterBook('Aria');
    book.entries = [
      {
        id: 1,
        keys: ['coast'],
        content:
          'Far from the city, the long southern coast is mapped in charcoal and kept in a locked case.',
        extensions: {},
        enabled: true,
        name: 'Coast',
      },
    ];
    const result = searchCard(card, book, action('search', { query: 'coast' }));
    expect(result.ok).toBe(true);
    expect(result.message).toContain('description');
    expect(result.message).toContain('#1 Coast');
    expect(result.message).not.toContain('\n---\n');
  });
});

describe('replaceAcrossCard', () => {
  it('rewrites spec, greetings, and lore in one call', () => {
    const card = spec({
      description: 'Aria draws maps.',
      alternate_greetings: ['Hi Aria.'],
    });
    const book = createEmptyCharacterBook('Aria');
    book.entries = [
      {
        id: 1,
        keys: ['Aria'],
        content: 'Aria lives here.',
        extensions: {},
        enabled: true,
        name: 'Aria',
      },
    ];
    const applied = replaceAcrossCard(
      card,
      book,
      action('replace_across', { old: 'Aria', new: 'Lyra', replace_all: 'true' }),
    );
    expect(applied.result.ok).toBe(true);
    expect(applied.spec.description).toBe('Lyra draws maps.');
    expect(applied.spec.alternate_greetings).toEqual(['Hi Lyra.']);
    expect(applied.book.entries[0].content).toBe('Lyra lives here.');
    expect(applied.book.entries[0].keys).toEqual(['Lyra']);
    expect(applied.book.entries[0].name).toBe('Lyra');
  });
});

describe('auditCard', () => {
  it('summarizes empty fields and omits bodies', () => {
    const result = auditCard(spec({ description: 'SECRET BODY' }), createEmptyCharacterBook('Aria'));
    expect(result.ok).toBe(true);
    expect(result.message).toContain('Card audit');
    expect(result.message).toContain('Empty fields');
    expect(result.message).not.toContain('SECRET BODY');
  });

  it('audits playable spec fields and splits description-covered vs optional empties', () => {
    const result = auditCard(
      spec({
        name: 'Aria',
        description: 'A cartographer who maps harbors.',
        personality: '',
        scenario: 'A rain-soaked port.',
        first_mes: 'Hello.',
        mes_example: '',
        system_prompt: '',
        post_history_instructions: '',
        physical_description: '',
        creator: '',
        creator_notes: 'PRIVATE NOTES',
        character_version: '',
        avatar: '',
        tags: [],
      }),
      createEmptyCharacterBook('Aria'),
    );
    expect(result.message).toContain('2/4 required filled');
    expect(result.message).toContain('Empty fields: mes_example, tags');
    expect(result.message).toContain('Empty (ok if in description): physical_description, personality');
    expect(result.message).toContain('Empty (optional): system_prompt, post_history_instructions');
    expect(result.message).not.toContain('Empty (optional): scenario');
    expect(result.message).not.toContain('Name');
    expect(result.message).not.toContain('Creator');
    expect(result.message).not.toContain('Version');
    expect(result.message).not.toContain('Avatar');
    expect(result.message).not.toContain('PRIVATE NOTES');
    expect(result.message).toContain('Lorebook:');
  });
});
