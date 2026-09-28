// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

type Props = Partial<React.ComponentProps<typeof GreetingsEditor>>;

function editor(props: Props = {}) {
  return (
    <GreetingsEditor
      greetings={['Alpha greeting', 'Bravo', 'Charlie']}
      onChange={() => undefined}
      selectedText=""
      setSelectedText={() => undefined}
      contextSectionIds={[]}
      aiConfig={{} as AIConfig}
      samplerSettings={{} as SamplerSettings}
      promptSettings={{} as PromptSettings}
      getContextContent={() => []}
      activeSection="alternate_greetings"
      {...props}
    />
  );
}

const row = (n: number) => screen.getAllByText(`Greeting ${n}`)[0];

describe('GreetingsEditor selection', () => {
  it('starts on the remembered greeting and reports changes', () => {
    const onSelectedIndexChange = vi.fn();
    render(editor({ initialIndex: 2, onSelectedIndexChange }));
    expect(mounts).toEqual(['Charlie']);
    expect(onSelectedIndexChange).toHaveBeenLastCalledWith(2);

    fireEvent.click(row(1));
    expect(onSelectedIndexChange).toHaveBeenLastCalledWith(0);
  });

  it('jumps to a focused greeting once, clamped to the list', () => {
    const { rerender } = render(editor({ focusGreeting: { index: 1, nonce: 1 } }));
    expect(mounts).toEqual(['Bravo']);

    fireEvent.click(row(1));
    rerender(editor({ focusGreeting: { index: 1, nonce: 1 } }));
    expect(mounts).toEqual(['Bravo', 'Alpha greeting']);

    rerender(editor({ focusGreeting: { index: 9, nonce: 2 } }));
    expect(mounts).toEqual(['Bravo', 'Alpha greeting', 'Charlie']);
  });
});
