// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentChatMessage } from '../../../src/agent/ui/AgentChatMessage';
import { TURN_LIMIT_NOTICE } from '../../../src/agent/ui/notices';
import type { ChatMessage } from '../../../src/components/ai/types';

afterEach(cleanup);

const message: ChatMessage = { id: 'a1', role: 'assistant', content: '', timestamp: 1 };

function renderMessage(notices: string[], onContinue?: () => void) {
  return render(
    <AgentChatMessage
      message={message}
      messageIndex={0}
      chatHistoryLength={1}
      isProcessing={false}
      showReasoning={false}
      showRegenerate={false}
      notices={notices}
      toolEvents={[]}
      onRegenerate={() => undefined}
      onDelete={() => undefined}
      onContinue={onContinue}
    />,
  );
}

describe('AgentChatMessage turn-limit notice', () => {
  it('offers Continue on the latest message', () => {
    const onContinue = vi.fn();
    renderMessage([TURN_LIMIT_NOTICE], onContinue);
    expect(screen.getByText(TURN_LIMIT_NOTICE)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('shows the notice without Continue on older messages', () => {
    renderMessage([TURN_LIMIT_NOTICE]);
    expect(screen.getByText(TURN_LIMIT_NOTICE)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('never offers Continue on an error notice', () => {
    renderMessage(['Provider returned 500'], vi.fn());
    expect(screen.getByText('Provider returned 500')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });
});
