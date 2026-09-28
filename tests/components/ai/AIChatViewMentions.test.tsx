// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIChatView } from '../../../src/components/ai/AIChatView';

afterEach(cleanup);

function renderView(mentionOptions?: () => Array<{ label: string; detail?: string }>) {
  const handleAsk = vi.fn(async () => undefined);
  render(
    <AIChatView
      title="Agent"
      emptyTitle="Empty"
      emptyBody=""
      placeholder="Tell the agent"
      contextLabels={[]}
      contextEmptyHint=""
      chatHistory={[]}
      isProcessing={false}
      error={null}
      isStreaming={false}
      streamingContent=""
      streamingReasoning=""
      handleAsk={handleAsk}
      handleRegenerate={async () => undefined}
      handleNewChat={() => undefined}
      handleDeleteMessage={() => undefined}
      handleAbort={() => undefined}
      clearError={() => undefined}
      mentionOptions={mentionOptions}
    />,
  );
  const composer = screen.getByPlaceholderText('Tell the agent') as HTMLTextAreaElement;
  return { composer, handleAsk };
}

function type(composer: HTMLTextAreaElement, value: string) {
  fireEvent.change(composer, { target: { value } });
  composer.setSelectionRange(value.length, value.length);
  fireEvent.select(composer);
}

const OPTIONS = () => [{ label: 'Description', detail: 'Field' }, { label: '“Harbor” (#4)', detail: 'Entry' }];

describe('AIChatView mentions', () => {
  it('Enter picks the highlighted mention instead of sending', () => {
    const { composer, handleAsk } = renderView(OPTIONS);
    type(composer, 'Tighten @har');
    expect(screen.getByRole('option', { name: /Harbor/ })).toBeTruthy();
    fireEvent.keyDown(composer, { key: 'Enter' });
    expect(composer.value).toBe('Tighten @“Harbor” (#4) ');
    expect(handleAsk).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Escape closes the list and Enter then sends', () => {
    const { composer, handleAsk } = renderView(OPTIONS);
    type(composer, '@de');
    fireEvent.keyDown(composer, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(composer, { key: 'Enter' });
    expect(handleAsk).toHaveBeenCalledWith('@de');
  });

  it('clicking an option inserts it', () => {
    const { composer } = renderView(OPTIONS);
    type(composer, '@');
    fireEvent.click(screen.getByRole('option', { name: /Description/ }));
    expect(composer.value).toBe('@Description ');
  });

  it('never opens without mention options', () => {
    const { composer } = renderView();
    type(composer, '@de');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
