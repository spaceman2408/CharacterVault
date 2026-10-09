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

function renderUserMessage(onEdit?: () => void, isProcessing = false, onCancelEdit?: () => void) {
  return render(
    <AgentChatMessage
      message={{ id: 'u1', role: 'user', content: 'Write a greeting', timestamp: 1 }}
      messageIndex={0}
      chatHistoryLength={1}
      isProcessing={isProcessing}
      showReasoning={false}
      showRegenerate={false}
      notices={[]}
      toolEvents={[]}
      onRegenerate={() => undefined}
      onDelete={() => undefined}
      onEdit={onEdit}
      onCancelEdit={onCancelEdit}
    />,
  );
}

describe('AgentChatMessage edit', () => {
  it('offers edit on the last user message', () => {
    const onEdit = vi.fn();
    renderUserMessage(onEdit);
    fireEvent.click(screen.getByRole('button', { name: 'Edit and resend' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('hides edit on older user messages', () => {
    renderUserMessage();
    expect(screen.queryByRole('button', { name: 'Edit and resend' })).toBeNull();
  });

  it('disables edit while a run is in progress', () => {
    const onEdit = vi.fn();
    renderUserMessage(onEdit, true);
    const button = screen.getByRole('button', { name: 'Edit and resend' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('shows Editing and Cancel while the message is being edited', () => {
    const onCancelEdit = vi.fn();
    renderUserMessage(vi.fn(), false, onCancelEdit);
    expect(screen.getByText('· Editing')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit and resend' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel edit' }));
    expect(onCancelEdit).toHaveBeenCalledTimes(1);
  });
});

describe('AgentChatMessage lost writes', () => {
  const write = {
    toolName: 'update_entry',
    ok: true,
    message: 'ok #0 Mira',
    target: { type: 'entry' as const, id: 0 },
  };

  function renderWrite(writesLost: boolean, onOpenTarget = vi.fn()) {
    render(
      <AgentChatMessage
        message={message}
        messageIndex={0}
        chatHistoryLength={1}
        isProcessing={false}
        showReasoning={false}
        showRegenerate={false}
        notices={[]}
        toolEvents={[write]}
        writesLost={writesLost}
        onRegenerate={() => undefined}
        onDelete={() => undefined}
        onOpenTarget={onOpenTarget}
      />,
    );
    return onOpenTarget;
  }

  it('opens the target of a saved write', () => {
    const onOpenTarget = renderWrite(false);
    fireEvent.click(screen.getByRole('button', { name: /Mira/ }));
    expect(onOpenTarget).toHaveBeenCalledTimes(1);
  });

  it('strikes out a write that was never saved and does not open it', () => {
    renderWrite(true);
    expect(screen.queryByRole('button', { name: /Mira/ })).toBeNull();
    expect(screen.getByTitle('Not saved').className).toContain('line-through');
  });
});
