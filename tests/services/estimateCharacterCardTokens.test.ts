import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  estimateCharacterCardTokens,
  formatTokenEstimate,
} from '../../src/services/AIService';
import type { CharacterSpec, CharacterBook } from '../../src/db/characterTypes';

function emptySpec(overrides: Partial<CharacterSpec> = {}): CharacterSpec {
  return {
    name: '',
    description: '',
    personality: '',
    scenario: '',
    first_mes: '',
    mes_example: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    physical_description: '',
    ...overrides,
  };
}

describe('estimateCharacterCardTokens', () => {
  it('returns zeros for empty card', () => {
    expect(estimateCharacterCardTokens({ spec: emptySpec() })).toEqual({
      active: 0,
      total: 0,
    });
  });

  it('counts definition fields as both active and total', () => {
    const description = 'Hello world, this is a description.';
    const personality = 'Brave and kind';
    const appearance = 'Tall with silver hair';
    const { active, total } = estimateCharacterCardTokens({
      spec: emptySpec({
        name: 'Aria',
        description,
        personality,
        physical_description: appearance,
      }),
    });
    const expected =
      estimateTokens('Aria') +
      estimateTokens(description) +
      estimateTokens(personality) +
      estimateTokens(appearance);
    expect(active).toBe(expected);
    expect(total).toBe(expected);
  });

  it('uses name fallback when spec.name is empty', () => {
    const { active, total } = estimateCharacterCardTokens({ spec: emptySpec() }, 'Fallback');
    expect(active).toBe(estimateTokens('Fallback'));
    expect(total).toBe(estimateTokens('Fallback'));
  });

  it('counts first message and greetings toward total only', () => {
    const description = 'A wanderer.';
    const firstMes = 'Hello there, traveler!';
    const alt = 'Another greeting.';
    const { active, total } = estimateCharacterCardTokens({
      spec: emptySpec({
        name: 'Hero',
        description,
        first_mes: firstMes,
        alternate_greetings: [alt],
      }),
    });
    const activeExpected = estimateTokens('Hero') + estimateTokens(description);
    expect(active).toBe(activeExpected);
    expect(total).toBe(
      activeExpected + estimateTokens(firstMes) + estimateTokens(alt)
    );
  });

  it('counts lorebook toward total only, not active', () => {
    const book: CharacterBook = {
      name: 'World',
      description: 'A place',
      extensions: {},
      entries: [
        {
          id: 1,
          keys: ['dragon', 'drake'],
          content: 'Dragons are rare.',
          extensions: {},
          enabled: true,
          name: 'Dragons',
        },
      ],
    };
    const { active, total } = estimateCharacterCardTokens({
      spec: emptySpec({ name: 'Hero', description: 'Brave' }),
      characterBook: book,
    });
    const activeExpected = estimateTokens('Hero') + estimateTokens('Brave');
    expect(active).toBe(activeExpected);
    expect(total).toBe(
      activeExpected +
        estimateTokens('World') +
        estimateTokens('A place') +
        estimateTokens('Dragons are rare.') +
        estimateTokens('dragon,drake') +
        estimateTokens('Dragons')
    );
  });

  it('includes mes_example as active (style examples stay in prompt)', () => {
    const examples = '{{user}}: Hi\n{{char}}: Hello';
    const { active, total } = estimateCharacterCardTokens({
      spec: emptySpec({ name: 'A', mes_example: examples }),
    });
    const expected = estimateTokens('A') + estimateTokens(examples);
    expect(active).toBe(expected);
    expect(total).toBe(expected);
  });
});

describe('formatTokenEstimate', () => {
  it('formats small and large values', () => {
    expect(formatTokenEstimate(42)).toBe('~42');
    expect(formatTokenEstimate(1500)).toBe('~1.5k');
    expect(formatTokenEstimate(12_400)).toBe('~12k');
  });
});
