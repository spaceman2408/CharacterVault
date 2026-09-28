// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatMessage } from '../../../src/components/ai/components/ChatMessage';

afterEach(cleanup);

function renderUserMessage(onEdit?: () => void, isProcessing = false, onCancelEdit?: () => void) {
  return render(
    <ChatMessage
      message={{ id: 'u1', role: 'user', content: 'Brainstorm a backstory', timestamp: 1 }}
      messageIndex={0}
      chatHistoryLength={1}
      isProcessing={isProcessing}
      onRegenerate={() => undefined}
      onDelete={() => undefined}
      onEdit={onEdit}
      onCancelEdit={onCancelEdit}
    />,
  );
}

describe('Orion ChatMessage edit', () => {
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

  it('disables edit while a reply is in progress', () => {
    renderUserMessage(vi.fn(), true);
    const button = screen.getByRole('button', { name: 'Edit and resend' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
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
