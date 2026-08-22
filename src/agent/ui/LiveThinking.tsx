import React from 'react';
import { FoldedText } from '../../components/ai/components/FoldedText';

export function LiveThinking({ text }: { text: string }): React.ReactElement | null {
  if (!text) return null;

  return (
    <FoldedText label="Thinking" defaultOpen>
      {text}
    </FoldedText>
  );
}
