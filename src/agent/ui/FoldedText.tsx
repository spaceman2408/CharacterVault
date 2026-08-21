import React, { type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export function FoldedText({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <details className="[&[open]_summary_svg]:rotate-90">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-fg-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3 w-3 shrink-0 transition-transform" />
        <span className="min-w-0 truncate">{label}</span>
      </summary>
      <div className="mt-1 max-h-40 overflow-y-auto pl-4 text-xs leading-relaxed wrap-break-word whitespace-pre-wrap text-fg-muted">
        {children}
      </div>
    </details>
  );
}
