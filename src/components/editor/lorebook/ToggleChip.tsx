import React from 'react';

export function ToggleChip({
  pressed,
  onPressedChange,
  children,
  title,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  children: React.ReactNode;
  title?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={() => onPressedChange(!pressed)}
      className={`inline-flex min-h-8 items-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors touch-manipulation ${
        pressed
          ? 'border-accent/40 bg-accent-soft text-accent'
          : 'border-border bg-surface text-fg-muted hover:bg-hover hover:text-fg'
      }`}
    >
      {children}
    </button>
  );
}
