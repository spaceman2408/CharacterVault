import React, { useLayoutEffect, useRef, type RefObject } from 'react';
import type { MentionRange } from './composerMentions';

/**
 * Tints `@mentions` by laying a copy of the composer text over the textarea. The copy's text is
 * transparent, so the textarea still draws the text, caret, and selection; only the tint shows.
 */
export function MentionHighlights({
  inputRef,
  text,
  ranges,
}: {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  ranges: MentionRange[];
}): React.ReactElement | null {
  const overlayRef = useRef<HTMLDivElement>(null);
  const hasRanges = ranges.length > 0;

  useLayoutEffect(() => {
    const input = inputRef.current;
    const overlay = overlayRef.current;
    if (!input || !overlay) return;
    // clientWidth leaves out the scrollbar, so the copy wraps where the textarea does.
    const sync = () => {
      const style = getComputedStyle(input);
      const borderX = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
      const borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      overlay.style.width = `${input.clientWidth + borderX}px`;
      overlay.style.height = `${input.clientHeight + borderY}px`;
      overlay.scrollTop = input.scrollTop;
    };
    sync();
    input.addEventListener('scroll', sync);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    observer?.observe(input);
    return () => {
      input.removeEventListener('scroll', sync);
      observer?.disconnect();
    };
  }, [inputRef, text, hasRanges]);

  if (!hasRanges) return null;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) parts.push(text.slice(cursor, range.start));
    parts.push(
      <mark key={range.start} className="rounded-[3px] bg-accent/30 text-transparent">
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  }
  parts.push(`${text.slice(cursor)}\n`);

  return (
    <div
      ref={overlayRef}
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-transparent px-3 py-2 text-sm text-transparent"
    >
      {parts}
    </div>
  );
}
