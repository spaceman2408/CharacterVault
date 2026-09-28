// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GreetingsEditor } from '../../../src/components/editor/GreetingsEditor';
import type { AIConfig, PromptSettings, SamplerSettings } from '../../../src/db/characterTypes';

const { mounts } = vi.hoisted(() => ({ mounts: [] as string[] }));

vi.mock('../../../src/hooks', async () => {
  const react = await import('react');
  return {
    useAIEditor: ({ value }: { value: string }) => {
      const initial = react.useRef(value);
      react.useEffect(() => {
        mounts.push(initial.current);
      }, []);
      return { editorRef: react.useRef(null), payloadPreviewModal: null };
    },
  };
});

beforeEach(() => {
  mounts.length = 0;
});
afterEach(cleanup);

function renderEditor(greetings = ['A', 'B', 'C']) {
  render(
    <GreetingsEditor
      greetings={greetings}
      onChange={() => undefined}
      selectedText=""
      setSelectedText={() => undefined}
      contextSectionIds={[]}
      aiConfig={{} as AIConfig}
      samplerSettings={{} as SamplerSettings}
      promptSettings={{} as PromptSettings}
      getContextContent={() => []}
      activeSection="alternate_greetings"
    />,
  );
}

const selectRow = (n: number) => fireEvent.click(screen.getAllByText(`Greeting ${n}`)[0]);

describe('GreetingsEditor editor per greeting', () => {
  it('mounts a fresh editor for a different greeting, not for the same one', () => {
    renderEditor();
    expect(mounts).toEqual(['A']);
    selectRow(2);
    expect(mounts).toEqual(['A', 'B']);
    selectRow(2);
    expect(mounts).toEqual(['A', 'B']);
  });

  it('mounts a fresh editor when the selected greeting is deleted', () => {
    renderEditor();
    selectRow(2);
    fireEvent.click(screen.getByRole('button', { name: 'Delete greeting 2' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(mounts).toEqual(['A', 'B', 'C']);
  });

  it('keeps the editor when the selected greeting only moves', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Move greeting 1 down' }));
    expect(mounts).toEqual(['A']);
  });

  it('mounts a fresh editor when another greeting moves into view', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Move greeting 3 up' }));
    expect(mounts).toEqual(['A', 'C']);
  });
});
