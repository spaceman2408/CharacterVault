import { useCallback, useMemo, useState } from 'react';
import type { ChatMessage } from '../types';
import { lastUserMessageIndex } from '../utils';

type SetComposerText = (text: string) => void;

/**
 * Edit on the last user message. Nothing is trimmed until the edited text is
 * sent, so a stray click or Cancel loses nothing.
 */
export function useEditLastMessage(
  chatHistory: ChatMessage[],
  deleteMessage: (messageId: string) => void,
) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const lastUserIndex = useMemo(() => lastUserMessageIndex(chatHistory), [chatHistory]);
  const lastUserId = lastUserIndex >= 0 ? chatHistory[lastUserIndex].id : null;
  const activeEditId = editingId != null && editingId === lastUserId ? editingId : null;

  const startEdit = useCallback((message: ChatMessage, setComposerText: SetComposerText) => {
    setComposerText(message.content);
    setEditingId(message.id);
  }, []);

  const cancelEdit = useCallback((setComposerText: SetComposerText) => {
    setComposerText('');
    setEditingId(null);
  }, []);

  const commitEdit = useCallback(() => {
    if (!activeEditId) return;
    deleteMessage(activeEditId);
    setEditingId(null);
  }, [activeEditId, deleteMessage]);

  return { lastUserIndex, editingId: activeEditId, startEdit, cancelEdit, commitEdit };
}
