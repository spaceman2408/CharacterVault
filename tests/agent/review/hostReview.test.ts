import { describe, expect, it, vi } from 'vitest';
import { createCharacterHost } from '../../../src/agent/hosts/character/createHost';
import { createLorebookHost } from '../../../src/agent/hosts/lorebook/createHost';
import type { CharacterBook, CharacterSpec } from '../../../src/db/characterTypes';
import { createEmptyCharacterBook } from '../../../src/db/characterTypes';

function action(name: string, headers: Record<string, string> = {}, body = '') {
  return { name, headers, body };
}

function cardSpec(): CharacterSpec {
  return {
    name: 'Aria',
    description: 'A cartographer.',
    personality: 'Quiet.',
    scenario: 'A port.',
    first_mes: 'Hello.',
    mes_example: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    physical_description: '',
  };
}

describe('character host review gate', () => {
  it('stages edits for review instead of persisting when shouldReview is true', async () => {
    const persist = vi.fn(async () => undefined);
    const takeSnapshot = vi.fn(async () => undefined);
    const onPendingReview = vi.fn();
    const host = createCharacterHost({
      getSpec: cardSpec,
      getBook: () => createEmptyCharacterBook('Aria'),
      persist,
      getCustomContext: async () => null,
      takeSnapshot,
      shouldReview: () => true,
      onPendingReview,
    });

    await host.execute(action('update_field', { id: 'description' }, 'A pirate queen.'));
    await host.flush?.();

    expect(persist).not.toHaveBeenCalled();
    expect(takeSnapshot).not.toHaveBeenCalled();
    expect(onPendingReview).toHaveBeenCalledTimes(1);
    const pending = onPendingReview.mock.calls[0][0];
    expect(pending.originalSpec.description).toBe('A cartographer.');
    expect(pending.proposedSpec?.description).toBe('A pirate queen.');
  });

  it('persists directly when shouldReview is false', async () => {
    const persist = vi.fn(async () => undefined);
    const onPendingReview = vi.fn();
    const host = createCharacterHost({
      getSpec: cardSpec,
      getBook: () => createEmptyCharacterBook('Aria'),
      persist,
      getCustomContext: async () => null,
      shouldReview: () => false,
      onPendingReview,
    });

    await host.execute(action('update_field', { id: 'description' }, 'A pirate queen.'));
    await host.flush?.();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(onPendingReview).not.toHaveBeenCalled();
  });
});

describe('lorebook host review gate', () => {
  it('stages the book for review instead of persisting when shouldReview is true', async () => {
    let book: CharacterBook = createEmptyCharacterBook('World');
    const setBook = vi.fn(async (next: CharacterBook) => {
      book = next;
    });
    const takeSnapshot = vi.fn(async () => undefined);
    const onPendingReview = vi.fn();
    const host = createLorebookHost({
      getBook: () => book,
      setBook,
      getCustomContext: async () => null,
      takeSnapshot,
      shouldReview: () => true,
      onPendingReview,
    });

    await host.execute(action('add_entry', { name: 'Harbor', keys: 'harbor' }, 'A busy harbor.'));
    await host.flush?.();

    expect(setBook).not.toHaveBeenCalled();
    expect(takeSnapshot).not.toHaveBeenCalled();
    expect(onPendingReview).toHaveBeenCalledTimes(1);
    const pending = onPendingReview.mock.calls[0][0];
    expect(pending.originalBook.entries).toHaveLength(0);
    expect(pending.proposedBook.entries).toHaveLength(1);
    expect(book.entries).toHaveLength(0);
  });
});
