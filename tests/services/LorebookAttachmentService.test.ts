import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterBook, VaultLorebook } from '../../src/db/characterTypes';

const {
  updateLorebook,
  getCharacterIdsLinkedToLorebook,
  updateCharacterEmbeddedBook,
  getCharacterLorebookAttachments,
  hasLorebook,
} = vi.hoisted(() => ({
  updateLorebook: vi.fn(),
  getCharacterIdsLinkedToLorebook: vi.fn(),
  updateCharacterEmbeddedBook: vi.fn(),
  getCharacterLorebookAttachments: vi.fn(),
  hasLorebook: vi.fn(),
}));

vi.mock('../../src/db/CharacterDatabase', () => ({
  characterDb: {
    updateLorebook,
    getCharacterIdsLinkedToLorebook,
    updateCharacterEmbeddedBook,
    getCharacterLorebookAttachments,
    hasLorebook,
  },
}));

import {
  cloneBookForEmbed,
  cloneEmbeddedBook,
  lorebookAttachmentService,
} from '../../src/services/LorebookAttachmentService';

function makeEntry(id: number, content: string) {
  return {
    id,
    keys: ['alpha'],
    content,
    extensions: { note: 'keep' },
    enabled: true,
    secondary_keys: ['beta'],
  };
}

function makeVaultBook(overrides: Partial<VaultLorebook> = {}): VaultLorebook {
  return {
    id: 'vault-1',
    name: 'Vault Bible',
    description: 'Vault description',
    tags: [],
    version: 1,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    book: {
      name: 'Book name',
      description: 'Book description',
      entries: [makeEntry(0, 'old vault content')],
      extensions: { source: 'vault' },
    },
    ...overrides,
  };
}

describe('cloneEmbeddedBook / cloneBookForEmbed', () => {
  it('clones entries so later edits do not mutate the source', () => {
    const source: CharacterBook = {
      name: 'Embedded',
      description: 'Notes',
      entries: [makeEntry(1, 'live edit')],
      extensions: { a: 1 },
    };

    const cloned = cloneEmbeddedBook(source, 'Fallback');
    cloned.entries[0].content = 'changed';
    cloned.entries[0].keys.push('gamma');
    cloned.entries[0].secondary_keys?.push('delta');

    expect(source.entries[0].content).toBe('live edit');
    expect(source.entries[0].keys).toEqual(['alpha']);
    expect(source.entries[0].secondary_keys).toEqual(['beta']);
  });

  it('uses the fallback name when the embedded book has no name', () => {
    const cloned = cloneEmbeddedBook(
      { name: '  ', description: '', entries: [], extensions: {} },
      "Mira's Lorebook",
    );
    expect(cloned.name).toBe("Mira's Lorebook");
  });

  it('copies vault name and description onto the embedded clone', () => {
    const vault = makeVaultBook({
      book: {
        name: '',
        description: undefined,
        entries: [makeEntry(0, 'entry')],
        extensions: {},
      },
    });
    const cloned = cloneBookForEmbed(vault);
    expect(cloned.name).toBe('Vault Bible');
    expect(cloned.description).toBe('Vault description');
    expect(cloned.entries[0].content).toBe('entry');
  });
});

describe('LorebookAttachmentService.writeEmbeddedToVault', () => {
  beforeEach(() => {
    updateLorebook.mockReset();
    getCharacterIdsLinkedToLorebook.mockReset();
    updateCharacterEmbeddedBook.mockReset();
    getCharacterIdsLinkedToLorebook.mockResolvedValue([]);
    updateCharacterEmbeddedBook.mockResolvedValue(true);
    updateLorebook.mockImplementation(async (id: string, input: { book: CharacterBook; name?: string; description?: string }) => ({
      ...makeVaultBook({ id }),
      name: input.name ?? 'Vault Bible',
      description: input.description,
      book: input.book,
    }));
  });

  it('writes the embedded book onto the vault lorebook', async () => {
    const embedded: CharacterBook = {
      name: 'Edited in character',
      description: 'New notes',
      entries: [makeEntry(2, 'character editor content')],
      extensions: {},
    };

    const updated = await lorebookAttachmentService.writeEmbeddedToVault(
      'vault-1',
      embedded,
      'Fallback',
    );

    expect(updateLorebook).toHaveBeenCalledTimes(1);
    const [lorebookId, input] = updateLorebook.mock.calls[0] as [
      string,
      { book: CharacterBook; name?: string; description?: string },
    ];
    expect(lorebookId).toBe('vault-1');
    expect(input.name).toBe('Edited in character');
    expect(input.description).toBe('New notes');
    expect(input.book.entries[0].content).toBe('character editor content');
    expect(updated.book.entries[0].content).toBe('character editor content');
  });

  it('does not mutate the embedded book when writing to the vault', async () => {
    const embedded: CharacterBook = {
      name: 'Live',
      description: '',
      entries: [makeEntry(0, 'original')],
      extensions: {},
    };

    await lorebookAttachmentService.writeEmbeddedToVault('vault-1', embedded, 'Fallback');
    const written = (updateLorebook.mock.calls[0] as [string, { book: CharacterBook }])[1].book;
    written.entries[0].content = 'mutated after write';

    expect(embedded.entries[0].content).toBe('original');
  });

  it('pushes the updated vault book to every linked character', async () => {
    getCharacterIdsLinkedToLorebook.mockResolvedValue(['char-a', 'char-b']);

    await lorebookAttachmentService.writeEmbeddedToVault(
      'vault-1',
      {
        name: 'Shared',
        description: '',
        entries: [makeEntry(0, 'from character A')],
        extensions: {},
      },
      'Fallback',
    );

    expect(getCharacterIdsLinkedToLorebook).toHaveBeenCalledWith('vault-1');
    expect(updateCharacterEmbeddedBook).toHaveBeenCalledTimes(2);
    const firstBook = updateCharacterEmbeddedBook.mock.calls[0][1] as CharacterBook;
    const secondBook = updateCharacterEmbeddedBook.mock.calls[1][1] as CharacterBook;
    expect(firstBook.entries[0].content).toBe('from character A');
    expect(secondBook.entries[0].content).toBe('from character A');
    firstBook.entries[0].content = 'mutated';
    expect(secondBook.entries[0].content).toBe('from character A');
  });
});

describe('LorebookAttachmentService.writeVaultToLinkedCharacters', () => {
  beforeEach(() => {
    getCharacterIdsLinkedToLorebook.mockReset();
    updateCharacterEmbeddedBook.mockReset();
    updateCharacterEmbeddedBook.mockResolvedValue(true);
  });

  it('writes a clone of the vault book to each linked character', async () => {
    getCharacterIdsLinkedToLorebook.mockResolvedValue(['char-a', 'char-b']);
    const vault = makeVaultBook();

    const written = await lorebookAttachmentService.writeVaultToLinkedCharacters(
      vault.id,
      vault,
    );

    expect(written).toBe(2);
    expect(updateCharacterEmbeddedBook).toHaveBeenCalledTimes(2);
    expect(updateCharacterEmbeddedBook.mock.calls[0][0]).toBe('char-a');
    expect(updateCharacterEmbeddedBook.mock.calls[1][0]).toBe('char-b');
    expect(updateCharacterEmbeddedBook.mock.calls[0][1].entries[0].content).toBe(
      'old vault content',
    );
  });

  it('is a no-op when no characters are linked', async () => {
    getCharacterIdsLinkedToLorebook.mockResolvedValue([]);

    const written = await lorebookAttachmentService.writeVaultToLinkedCharacters(
      'vault-1',
      makeVaultBook(),
    );

    expect(written).toBe(0);
    expect(updateCharacterEmbeddedBook).not.toHaveBeenCalled();
  });

  it('does not count characters that disappeared during the write', async () => {
    getCharacterIdsLinkedToLorebook.mockResolvedValue(['gone', 'still-here']);
    updateCharacterEmbeddedBook.mockImplementation(async (id: string) => id !== 'gone');

    const written = await lorebookAttachmentService.writeVaultToLinkedCharacters(
      'vault-1',
      makeVaultBook(),
    );

    expect(written).toBe(1);
  });
});

describe('LorebookAttachmentService.syncEmbeddedIfAttached', () => {
  const embedded: CharacterBook = {
    name: 'Agent book',
    description: '',
    entries: [makeEntry(3, 'new agent entry')],
    extensions: {},
  };

  beforeEach(() => {
    updateLorebook.mockReset();
    getCharacterIdsLinkedToLorebook.mockReset();
    updateCharacterEmbeddedBook.mockReset();
    getCharacterLorebookAttachments.mockReset();
    hasLorebook.mockReset();
    getCharacterIdsLinkedToLorebook.mockResolvedValue([]);
    updateCharacterEmbeddedBook.mockResolvedValue(true);
    hasLorebook.mockResolvedValue(true);
    updateLorebook.mockImplementation(async (id: string, input: { book: CharacterBook; name?: string }) => ({
      ...makeVaultBook({ id }),
      name: input.name ?? 'Vault Bible',
      book: input.book,
    }));
  });

  it('writes the embedded book to the attached vault lorebook', async () => {
    getCharacterLorebookAttachments.mockResolvedValue({
      characterId: 'char-1',
      lorebookIds: ['vault-1'],
      updatedAt: '2020-01-01T00:00:00.000Z',
    });

    const synced = await lorebookAttachmentService.syncEmbeddedIfAttached(
      'char-1',
      embedded,
      'Fallback',
    );

    expect(synced).toBe(true);
    expect(updateLorebook).toHaveBeenCalledTimes(1);
    const written = (updateLorebook.mock.calls[0] as [string, { book: CharacterBook }])[1].book;
    expect(written.entries[0].content).toBe('new agent entry');
  });

  it('does not rewrite the character that was just saved', async () => {
    getCharacterLorebookAttachments.mockResolvedValue({
      characterId: 'char-1',
      lorebookIds: ['vault-1'],
      updatedAt: '2020-01-01T00:00:00.000Z',
    });
    getCharacterIdsLinkedToLorebook.mockResolvedValue(['char-1', 'char-2']);

    await lorebookAttachmentService.syncEmbeddedIfAttached('char-1', embedded, 'Fallback');

    expect(updateCharacterEmbeddedBook).toHaveBeenCalledTimes(1);
    expect(updateCharacterEmbeddedBook.mock.calls[0][0]).toBe('char-2');
  });

  it('is a no-op when the character has no attached vault book', async () => {
    getCharacterLorebookAttachments.mockResolvedValue(undefined);

    const synced = await lorebookAttachmentService.syncEmbeddedIfAttached(
      'char-1',
      embedded,
      'Fallback',
    );

    expect(synced).toBe(false);
    expect(hasLorebook).not.toHaveBeenCalled();
    expect(updateLorebook).not.toHaveBeenCalled();
  });

  it('is a no-op when the attached vault book is missing', async () => {
    getCharacterLorebookAttachments.mockResolvedValue({
      characterId: 'char-1',
      lorebookIds: ['missing-vault'],
      updatedAt: '2020-01-01T00:00:00.000Z',
    });
    hasLorebook.mockResolvedValue(false);

    const synced = await lorebookAttachmentService.syncEmbeddedIfAttached(
      'char-1',
      embedded,
      'Fallback',
    );

    expect(synced).toBe(false);
    expect(updateLorebook).not.toHaveBeenCalled();
  });
});
