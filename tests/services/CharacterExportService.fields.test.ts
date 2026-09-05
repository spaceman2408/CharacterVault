import { describe, expect, it } from 'vitest';
import type { Character } from '../../src/db/characterTypes';
import { CharacterExportService } from '../../src/services/CharacterExportService';

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

describe('CharacterExportService card field coverage', () => {
  const service = new CharacterExportService();

  it('exports physical_description in V3 JSON', async () => {
    const result = await service.exportAsJSON(makeCharacter());
    expect(result.success).toBe(true);
    const card = JSON.parse(await result.blob!.text());
    expect(card.spec).toBe('chara_card_v3');
    expect(card.data.physical_description).toBe(PHYSICAL_DESCRIPTION);
  });

  it('exports physical_description in V2 JSON', async () => {
    const result = await service.exportAsV2(makeCharacter());
    expect(result.success).toBe(true);
    const card = JSON.parse(await result.blob!.text());
    expect(card.spec).toBe('chara_card_v2');
    expect(card.data.physical_description).toBe(PHYSICAL_DESCRIPTION);
  });
});
