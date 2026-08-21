import React, { useEffect, useRef } from 'react';

export function LiveThinking({ text }: { text: string }): React.ReactElement | null {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [text]);

  if (!text) return null;

  return (
    <div
      ref={scrollerRef}
      className="mt-1.5 max-h-32 overflow-y-auto text-xs leading-relaxed wrap-break-word whitespace-pre-wrap text-fg-muted"
    >
      {text}
    </div>
  );
}
