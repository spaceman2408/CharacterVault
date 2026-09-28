import React, { useCallback, useMemo } from 'react';
import type { AIChatPanelProps, ChatMessage } from './types';
import { AIChatView } from './AIChatView';
import { ChatMessage as ChatMessageComponent } from './components';
import { useAIChat, useEditLastMessage } from './hooks';
import { CHARACTER_SECTIONS } from '../../db/characterTypes';

export type { ChatMessage, AIChatPanelProps } from './types';

export function AIChatPanel({
  contextEntryIds,
  customContextIncluded = false,
  aiConfig,
  samplerSettings,
  promptSettings,
  getContextContent,
  onClose,
  headerLeading,
  headerActions,
  isMobile: _isMobile = false,
  chatOwnerType,
  chatOwnerId,
  chatPanel = 'orion',
}: AIChatPanelProps): React.ReactElement {
  void _isMobile;

  const {
    chatHistory,
    isProcessing,
    error,
    isStreaming,
    streamingContent,
    streamingReasoning,
    handleAsk,
    handleRegenerate,
    handleNewChat,
    handleDeleteMessage,
    handleAbort,
    clearError,
    isHydrating,
    hasOlderMessages,
    handleLoadOlder,
  } = useAIChat({
    aiConfig,
    samplerSettings,
    promptSettings,
    enableStreaming: aiConfig.enableStreaming ?? true,
    showReasoning: aiConfig.showReasoning ?? true,
    getContextContent,
    contextEntryIds,
    customContextIncluded,
    chatOwnerType,
    chatOwnerId,
    chatPanel,
  });

  const { lastUserIndex, editingId, startEdit, cancelEdit, commitEdit } = useEditLastMessage(
    chatHistory,
    handleDeleteMessage,
  );

  const handleComposerAsk = useCallback(
    (question: string) => handleAsk(question, commitEdit),
    [commitEdit, handleAsk],
  );

  const showReasoning = aiConfig.showReasoning ?? true;

  const renderMessage = useCallback(
    (message: ChatMessage, index: number, setComposerText: (text: string) => void) => (
      <ChatMessageComponent
        message={message}
        messageIndex={index}
        chatHistoryLength={chatHistory.length}
        showReasoning={showReasoning}
        isProcessing={isProcessing}
        onRegenerate={handleRegenerate}
        onDelete={handleDeleteMessage}
        onEdit={index === lastUserIndex ? () => startEdit(message, setComposerText) : undefined}
        onCancelEdit={message.id === editingId ? () => cancelEdit(setComposerText) : undefined}
      />
    ),
    [
      cancelEdit,
      chatHistory.length,
      editingId,
      handleDeleteMessage,
      handleRegenerate,
      isProcessing,
      lastUserIndex,
      showReasoning,
      startEdit,
    ],
  );

  const contextLabels = useMemo(() => {
    const labels = contextEntryIds
      .map((id) => CHARACTER_SECTIONS.find((s) => s.id === id)?.label ?? id)
      .filter(Boolean);
    if (customContextIncluded) labels.push('Custom context');
    return labels;
  }, [contextEntryIds, customContextIncluded]);

  return (
    <AIChatView
      title="Ask Orion"
      emptyTitle="Hi, I'm Orion"
      emptyBody={
        <>
          Ask about your character card, brainstorm ideas, or get writing help.
          {contextLabels.length === 0 && (
            <>
              {' '}
              Pin sections in <span className="text-fg-muted">AI Context</span> first for better
              answers.
            </>
          )}
        </>
      }
      placeholder="Message Orion…"
      contextLabels={contextLabels}
      contextEmptyHint="No context pinned. Use the AI Context panel so Orion can see card sections or custom notes."
      headerLeading={headerLeading}
      headerActions={headerActions}
      showReasoning={showReasoning}
      chatHistory={chatHistory}
      isProcessing={isProcessing}
      error={error}
      isStreaming={isStreaming}
      streamingContent={streamingContent}
      streamingReasoning={streamingReasoning}
      handleAsk={handleComposerAsk}
      handleRegenerate={handleRegenerate}
      handleNewChat={handleNewChat}
      handleDeleteMessage={handleDeleteMessage}
      handleAbort={handleAbort}
      clearError={clearError}
      isHydrating={isHydrating}
      hasOlderMessages={hasOlderMessages}
      onLoadOlder={handleLoadOlder}
      renderMessage={renderMessage}
      onClose={onClose}
    />
  );
}

export default AIChatPanel;
