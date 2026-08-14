import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createLorebook } = vi.hoisted(() => ({
  createLorebook: vi.fn(),
}));

vi.mock('../../src/db/CharacterDatabase', () => ({
  characterDb: { createLorebook },
  toLorebookListItem: vi.fn(),
}));

import { lorebookService, nameFromLorebookFile } from '../../src/services/LorebookService';

function cvBook(name: string) {
  return {
    name,
    description: '',
    entries: [
      { id: 0, keys: ['x'], content: '', extensions: {}, enabled: true },
    ],
  };
}

describe('nameFromLorebookFile', () => {
  it('keeps Windows download suffixes on the stem', () => {
    expect(nameFromLorebookFile('LORE OF MATRUS PRIME 2 (1) (1).json')).toBe(
      'LORE OF MATRUS PRIME 2 (1) (1)',
    );
  });

  it('strips .json case-insensitively', () => {
    expect(nameFromLorebookFile('World.JSON')).toBe('World');
  });
});

describe('LorebookService.importFromFile', () => {
  beforeEach(() => {
    createLorebook.mockReset();
    createLorebook.mockImplementation(async (input: { name: string }) => input);
  });

  it('uses the filename even when the JSON has a shorter name', async () => {
    const file = new File(
      [JSON.stringify(cvBook('LORE OF MATRUS PRIME 2'))],
      'LORE OF MATRUS PRIME 2 (1) (1).json',
      { type: 'application/json' },
    );

    await lorebookService.importFromFile(file);

    expect(createLorebook).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'LORE OF MATRUS PRIME 2 (1) (1)',
        book: expect.objectContaining({ name: 'LORE OF MATRUS PRIME 2 (1) (1)' }),
      }),
    );
  });

  it('falls back to the JSON name when the file has no stem', async () => {
    const file = new File([JSON.stringify(cvBook('Kingdom'))], '.json', {
      type: 'application/json',
    });

    await lorebookService.importFromFile(file);

    expect(createLorebook).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Kingdom' }),
    );
  });
});
