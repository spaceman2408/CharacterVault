import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../../src/db/characterTypes';
import { characterDb } from '../../src/db/CharacterDatabase';
import { CharacterExportService } from '../../src/services/CharacterExportService';
import { CharacterImportService } from '../../src/services/CharacterImportService';

vi.mock('../../src/db/CharacterDatabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/db/CharacterDatabase')>();
  return {
    ...actual,
    characterDb: {
      createCharacter: vi.fn(),
    },
  };
});

const PHYSICAL_DESCRIPTION = 'Tall, silver hair, amber eyes.';

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'Kisuki',
    imageData: '',
    thumbnailData: '',
    version: 1,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    data: {
      spec: {
        name: 'Kisuki',
        description: 'A paralegal',
        personality: '',
        scenario: '',
        first_mes: '',
        mes_example: '',
        system_prompt: '',
        post_history_instructions: '',
        alternate_greetings: [],
        physical_description: PHYSICAL_DESCRIPTION,
        creator_notes: '',
        creator: '',
        character_version: '',
        tags: ['office'],
      },
      extensions: {},
    },
    ...overrides,
  };
}

function jsonFile(payload: unknown): File {
  return new File([JSON.stringify(payload)], 'card.json', { type: 'application/json' });
}

function capturedInput(): { name?: string; data?: Partial<Character['data']> } {
  const mock = vi.mocked(characterDb.createCharacter);
  expect(mock).toHaveBeenCalledTimes(1);
  return mock.mock.calls[0][0];
}

describe('CharacterImportService physical_description preservation', () => {
  const service = new CharacterImportService();
  const createCharacter = vi.mocked(characterDb.createCharacter);

  beforeEach(() => {
    createCharacter.mockReset();
    createCharacter.mockImplementation(async (input) => ({
      id: 'imported-1',
      name: input.name,
      imageData: input.imageData ?? '',
      thumbnailData: input.thumbnailData ?? '',
      version: 1,
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
      data: input.data as Character['data'],
    }));
  });

  it('imports physical_description from wrapped V3 JSON', async () => {
    const result = await service.importFromFile(jsonFile({
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: 'Kisuki',
        description: 'A paralegal',
        physical_description: PHYSICAL_DESCRIPTION,
      },
    }));
    expect(result.success).toBe(true);
    expect(capturedInput().data?.spec?.physical_description).toBe(PHYSICAL_DESCRIPTION);
  });

  it('imports physical_description from flat V2 JSON', async () => {
    const result = await service.importFromFile(jsonFile({
      name: 'Kisuki',
      description: 'A paralegal',
      physical_description: PHYSICAL_DESCRIPTION,
    }));
    expect(result.success).toBe(true);
    expect(capturedInput().data?.spec?.physical_description).toBe(PHYSICAL_DESCRIPTION);
  });

  it('imports physical_description from a SillyTavern clipboard payload', async () => {
    const result = await service.importFromClipboardData({
      source: 'st',
      character: {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
          name: 'Kisuki',
          description: 'A paralegal',
          physical_description: PHYSICAL_DESCRIPTION,
        },
      },
      avatar: null,
    });
    expect(result.success).toBe(true);
    expect(capturedInput().data?.spec?.physical_description).toBe(PHYSICAL_DESCRIPTION);
  });

  it('imports physical_description from a CharacterVault export JSON', async () => {
    const result = await service.importFromFile(jsonFile(makeCharacter()));
    expect(result.success).toBe(true);
    expect(capturedInput().data?.spec?.physical_description).toBe(PHYSICAL_DESCRIPTION);
  });

  it('survives a V3 JSON export → import round trip with all card fields', async () => {
    const source = makeCharacter({
      data: {
        spec: {
          ...makeCharacter().data.spec,
          personality: 'Dry wit',
          scenario: 'Late night at the office',
          first_mes: 'You again?',
          mes_example: '<START>\n{{user}}: Hi\n{{char}}: Hello.',
          system_prompt: 'Stay in character.',
          post_history_instructions: 'Keep replies short.',
          alternate_greetings: ['Back so soon?'],
          creator_notes: 'Test card',
          creator: 'tester',
          character_version: '1.2',
        },
        characterBook: {
          name: 'World Bible',
          description: '',
          entries: [
            { id: 0, keys: ['office'], content: 'The office.', extensions: {}, enabled: true },
          ],
          extensions: {},
        },
        extensions: { custom_flag: true },
      },
    });

    const exportResult = await new CharacterExportService().exportAsJSON(source);
    expect(exportResult.success).toBe(true);

    const importResult = await service.importFromFile(jsonFile(JSON.parse(await exportResult.blob!.text())));
    expect(importResult.success).toBe(true);

    const input = capturedInput();
    const spec = input.data?.spec;
    expect(spec?.physical_description).toBe(PHYSICAL_DESCRIPTION);
    expect(spec?.description).toBe('A paralegal');
    expect(spec?.personality).toBe('Dry wit');
    expect(spec?.scenario).toBe('Late night at the office');
    expect(spec?.first_mes).toBe('You again?');
    expect(spec?.mes_example).toBe('<START>\n{{user}}: Hi\n{{char}}: Hello.');
    expect(spec?.system_prompt).toBe('Stay in character.');
    expect(spec?.post_history_instructions).toBe('Keep replies short.');
    expect(spec?.alternate_greetings).toEqual(['Back so soon?']);
    expect(spec?.creator_notes).toBe('Test card');
    expect(spec?.creator).toBe('tester');
    expect(spec?.character_version).toBe('1.2');
    expect(spec?.tags).toEqual(['office']);
    expect(input.data?.characterBook?.entries[0]?.keys).toEqual(['office']);
    expect(input.data?.extensions).toMatchObject({ custom_flag: true });
  });
});

describe('V3-only card fields', () => {
  const service = new CharacterImportService();
  const createCharacter = vi.mocked(characterDb.createCharacter);

  const V3_EXTRAS = {
    nickname: 'Kis',
    group_only_greetings: ['Everyone here?'],
    source: ['https://example.com/kisuki'],
    creator_notes_multilingual: { ja: 'テスト' },
    assets: [{ type: 'icon', uri: 'ccdefault:', name: 'main', ext: 'png' }],
    creation_date: 1700000000,
    modification_date: 1700000500,
  };

  beforeEach(() => {
    createCharacter.mockReset();
    createCharacter.mockImplementation(async (input) => ({
      id: 'imported-1',
      name: input.name,
      imageData: input.imageData ?? '',
      thumbnailData: input.thumbnailData ?? '',
      version: 1,
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
      data: input.data as Character['data'],
    }));
  });

  it('keeps V3-only fields through import and V3 export', async () => {
    const card = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: { ...makeCharacter().data.spec, ...V3_EXTRAS, extensions: {} },
    };
    const imported = await service.importFromFile(jsonFile(card));
    expect(imported.success).toBe(true);
    expect(capturedInput().data?.spec).toMatchObject(V3_EXTRAS);

    const exported = await new CharacterExportService().exportAsJSON(imported.character!);
    const out = JSON.parse(await exported.blob!.text());
    expect(out.data).toMatchObject(V3_EXTRAS);
  });

  it('keeps V3-only fields from a SillyTavern clipboard payload', async () => {
    const result = await service.importFromClipboardData({
      source: 'st',
      character: { ...makeCharacter().data.spec, ...V3_EXTRAS, extensions: {} },
      avatar: null,
    });
    expect(result.success).toBe(true);
    expect(capturedInput().data?.spec).toMatchObject(V3_EXTRAS);
  });

  it('drops malformed V3-only values and defaults group greetings on V3 export', async () => {
    const card = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        ...makeCharacter().data.spec,
        extensions: {},
        nickname: 42,
        group_only_greetings: 'not an array',
        assets: [{ type: 'icon' }],
        creation_date: 'yesterday',
      },
    };
    const imported = await service.importFromFile(jsonFile(card));
    const spec = capturedInput().data?.spec;
    expect(spec?.nickname).toBeUndefined();
    expect(spec?.group_only_greetings).toBeUndefined();
    expect(spec?.assets).toBeUndefined();
    expect(spec?.creation_date).toBeUndefined();

    const v3 = JSON.parse(await (await new CharacterExportService().exportAsJSON(imported.character!)).blob!.text());
    expect(v3.data.group_only_greetings).toEqual([]);
    const v2 = JSON.parse(await (await new CharacterExportService().exportAsV2(imported.character!)).blob!.text());
    expect(v2.data).not.toHaveProperty('group_only_greetings');
  });
});
