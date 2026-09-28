import React, { useState } from 'react';

/**
 * Integer input that keeps the typed text while focused, so clearing or typing "-"
 * doesn't snap to a fallback. Valid in-range values commit as you type; on blur an
 * empty value becomes `fallback` and out-of-range values are clamped.
 */
export function NumberField({
  value,
  onCommit,
  fallback,
  min,
  max,
  className,
  ariaLabel,
}: {
  value: number;
  onCommit: (next: number) => void;
  fallback: number;
  min?: number;
  max?: number;
  className?: string;
  ariaLabel?: string;
}): React.ReactElement {
  const [draft, setDraft] = useState<string | null>(null);

  const clamp = (num: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, num));

  return (
    <input
      type="number"
      min={min}
      max={max}
      aria-label={ariaLabel}
      value={draft ?? String(value)}
      onFocus={() => setDraft(String(value))}
      onChange={(e) => {
        setDraft(e.target.value);
        const num = parseInt(e.target.value, 10);
        if (!Number.isNaN(num) && num === clamp(num) && num !== value) onCommit(num);
      }}
      onBlur={() => {
        const num = parseInt(draft ?? '', 10);
        const next = Number.isNaN(num) ? fallback : clamp(num);
        if (next !== value) onCommit(next);
        setDraft(null);
      }}
      className={className}
    />
  );
}
