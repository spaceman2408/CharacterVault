import React from 'react';
import { StreamingText } from '../../components/ai/StreamingText';

export function LiveSpeech({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming: boolean;
}): React.ReactElement | null {
  if (!text) return null;

  return (
    <div className="mt-1.5 text-sm text-fg">
      <StreamingText content={text} isStreaming={isStreaming} showCursor />
    </div>
  );
}
