// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIChatView } from '../../../src/components/ai/AIChatView';
import type { ChatMessage } from '../../../src/components/ai/types';

afterEach(cleanup);

const unanswered: ChatMessage[] = [
  { id: 'u1', role: 'user', content: 'Rewrite the intro', timestamp: 0 },
];
const answered: ChatMessage[] = [
  ...unanswered,
  { id: 'a1', role: 'assistant', content: 'Done.', timestamp: 0 },
];

function renderView(overrides: {
  chatHistory?: ChatMessage[];
  isProcessing?: boolean;
  error?: string | null;
  handleRegenerate?: () => Promise<void>;
  handleAbort?: () => void;
}) {
  render(
    <AIChatView
      title="Orion"
      emptyTitle="Empty"
      emptyBody=""
      placeholder="Message Orion"
      contextLabels={[]}
      contextEmptyHint=""
      chatHistory={overrides.chatHistory ?? unanswered}
      isProcessing={overrides.isProcessing ?? false}
      error={overrides.error ?? null}
      isStreaming={false}
      streamingContent=""
      streamingReasoning=""
      handleAsk={async () => undefined}
      handleRegenerate={overrides.handleRegenerate ?? (async () => undefined)}
      handleNewChat={() => undefined}
      handleDeleteMessage={() => undefined}
      handleAbort={overrides.handleAbort ?? (() => undefined)}
      clearError={() => undefined}
    />,
  );
  return screen.getByPlaceholderText('Message Orion') as HTMLTextAreaElement;
}

describe('AIChatView retry', () => {
  it('offers Retry on the error banner when the last message has no reply', async () => {
    const handleRegenerate = vi.fn(async () => undefined);
    renderView({ error: 'Rate limited', handleRegenerate });
    await act(async () => {
      fireEvent.click(screen.getByText('Retry'));
    });
    expect(handleRegenerate).toHaveBeenCalledTimes(1);
  });

  it('shows no Retry when the last reply arrived', () => {
    renderView({ chatHistory: answered, error: 'Could not load earlier messages.' });
    expect(screen.queryByText('Retry')).toBeNull();
    expect(screen.getByTitle('Send')).toBeTruthy();
  });

  it('retries on Enter with an empty composer and titles the button Retry', async () => {
    const handleRegenerate = vi.fn(async () => undefined);
    const composer = renderView({ handleRegenerate });
    expect(screen.getByTitle('Retry')).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(composer, { key: 'Enter' });
    });
    expect(handleRegenerate).toHaveBeenCalledTimes(1);
  });

  it('stops a running reply on Escape', () => {
    const handleAbort = vi.fn();
    const composer = renderView({ isProcessing: true, handleAbort });
    fireEvent.keyDown(composer, { key: 'Escape' });
    expect(handleAbort).toHaveBeenCalledTimes(1);
  });

  it('leaves Escape alone when nothing is running', () => {
    const handleAbort = vi.fn();
    const composer = renderView({ chatHistory: answered, handleAbort });
    fireEvent.keyDown(composer, { key: 'Escape' });
    expect(handleAbort).not.toHaveBeenCalled();
  });
});
