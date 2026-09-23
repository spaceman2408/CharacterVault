import React, { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

const THINKING_STICK_THRESHOLD = 32;

export function FoldedText({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}): React.ReactElement {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const stickRef = useRef(true);
  const pinRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      stickRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight <= THINKING_STICK_THRESHOLD;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (!el) return;
    if (!stickRef.current) return;
    el.scrollTop = el.scrollHeight;
    if (pinRafRef.current !== null) return;
    pinRafRef.current = requestAnimationFrame(() => {
      pinRafRef.current = null;
      const target = scrollerRef.current;
      if (!target || !stickRef.current) return;
      target.scrollTop = target.scrollHeight;
    });
  }, [children, open]);

  useEffect(() => {
    return () => {
      if (pinRafRef.current !== null) {
        cancelAnimationFrame(pinRafRef.current);
        pinRafRef.current = null;
      }
    };
  }, []);

  return (
    <details
      className="[&[open]_summary_svg]:rotate-90"
      open={open}
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open;
        if (nextOpen) stickRef.current = true;
        setOpen(nextOpen);
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-fg-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3 w-3 shrink-0 transition-transform" />
        <span className="min-w-0 truncate">{label}</span>
      </summary>
      {open ? (
        <div
          ref={scrollerRef}
          className="mt-1 max-h-40 overflow-y-auto pl-4 text-xs leading-relaxed wrap-break-word whitespace-pre-wrap text-fg-muted"
        >
          {children}
        </div>
      ) : null}
    </details>
  );
}
