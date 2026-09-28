// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LorebookEditor } from '../../../src/components/editor/lorebook/LorebookEditor';
import { createBlankLorebookEntry } from '../../../src/components/editor/lorebook/utils';
import type {
  AIConfig,
  CharacterBook,
  PromptSettings,
  SamplerSettings,
} from '../../../src/db/characterTypes';
import { estimateTokens } from '../../../src/services/AIService';

vi.mock('../../../src/hooks', async () => {
  const react = await import('react');
  return {
    useAIEditor: () => ({ editorRef: react.useRef(null), payloadPreviewModal: null }),
  };
});

afterEach(cleanup);

const contents = ['Short.', 'A much longer entry body that should estimate to more tokens than the first.', ''];

function book(): CharacterBook {
  return {
    name: 'Test book',
    description: '',
    extensions: {},
    entries: contents.map((content, id) => ({
      ...createBlankLorebookEntry(id),
      comment: `Entry ${'ABC'[id]}`,
      content,
    })),
  };
}

describe('LorebookEditor rows', () => {
  it('shows a content token count on every row, not only the selected one', () => {
    render(
      <LorebookEditor
        lorebook={book()}
        onChange={() => undefined}
        setSelectedText={() => undefined}
        contextSectionIds={[]}
        aiConfig={{} as AIConfig}
        samplerSettings={{} as SamplerSettings}
        promptSettings={{} as PromptSettings}
        getContextContent={() => []}
        activeSection="lorebook"
      />,
    );

    contents.forEach((content, index) => {
      const row = screen.getAllByText(`Entry ${'ABC'[index]}`)[0].closest('.rounded-xl') as HTMLElement;
      expect(row.textContent).toContain(`${estimateTokens(content)} tokens`);
    });
  });
});
