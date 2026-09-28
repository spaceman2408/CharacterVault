// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GreetingsEditor } from '../../../src/components/editor/GreetingsEditor';
import type { AIConfig, PromptSettings, SamplerSettings } from '../../../src/db/characterTypes';
import { estimateTokens } from '../../../src/services/AIService';

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

const row = (n: number) => screen.getAllByText(`Greeting ${n}`)[0].closest('button') as HTMLButtonElement;

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

describe('GreetingsEditor list', () => {
  it('shows tokens on every row and a total', () => {
    const greetings = ['Alpha greeting', 'Bravo', ''];
    render(editor({ greetings }));
    const counts = greetings.map((greeting) => estimateTokens(greeting));

    expect(row(1).textContent).toContain(`${counts[0]} tokens`);
    expect(row(2).textContent).toContain(`${counts[1]} tokens`);
    expect(row(3).textContent).toContain('Empty');
    expect(screen.getByText(`3 greetings · ${counts[0] + counts[1]} tokens`)).toBeTruthy();
  });

  it('selects rows from the keyboard and marks the selected one', () => {
    render(editor());
    expect(row(1).getAttribute('aria-current')).toBe('true');
    expect(row(2).getAttribute('aria-current')).toBeNull();

    row(2).focus();
    expect(document.activeElement).toBe(row(2));
    fireEvent.click(row(2));
    expect(row(2).getAttribute('aria-current')).toBe('true');
    expect(mounts).toEqual(['Alpha greeting', 'Bravo']);
  });
});
