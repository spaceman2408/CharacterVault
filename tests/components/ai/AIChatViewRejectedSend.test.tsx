// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIChatView } from '../../../src/components/ai/AIChatView';

afterEach(cleanup);

function renderView(handleAsk: (question: string) => Promise<boolean | void>) {
  render(
    <AIChatView
      title="Orion"
      emptyTitle="Empty"
      emptyBody=""
      placeholder="Message Orion"
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
    />,
  );
  return screen.getByPlaceholderText('Message Orion') as HTMLTextAreaElement;
}

async function send(composer: HTMLTextAreaElement, text: string) {
  fireEvent.change(composer, { target: { value: text } });
  await act(async () => {
    fireEvent.keyDown(composer, { key: 'Enter' });
  });
}

describe('AIChatView rejected send', () => {
  it('puts the text back when nothing was sent', async () => {
    const handleAsk = vi.fn(async () => false);
    const composer = renderView(handleAsk);
    await send(composer, '  Rewrite the intro  ');
    expect(handleAsk).toHaveBeenCalledWith('Rewrite the intro');
    expect(composer.value).toBe('  Rewrite the intro  ');
  });

  it('keeps the composer clear after a send', async () => {
    const composer = renderView(vi.fn(async () => undefined));
    await send(composer, 'Rewrite the intro');
    expect(composer.value).toBe('');
  });
});
