import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

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

  useEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [children, open]);

  return (
    <details
      className="[&[open]_summary_svg]:rotate-90"
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
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
