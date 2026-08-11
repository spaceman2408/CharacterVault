import React from 'react';
import type { LorebookEntry } from '../../../db/characterTypes';

function FlagChip({
  children,
  tone = 'muted',
}: {
  children: React.ReactNode;
  tone?: 'muted' | 'warn' | 'accent';
}) {
  const toneClass =
    tone === 'warn'
      ? 'border-warning/40 bg-warning/10 text-warning'
      : tone === 'accent'
        ? 'border-accent/40 bg-accent-soft text-accent'
        : 'border-border bg-muted text-fg-muted';
  return (
    <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

export function RecursionFlagChips({ entry }: { entry: LorebookEntry }): React.ReactElement {
  return (
    <>
      {!entry.enabled && (
        <FlagChip tone="warn">Disabled</FlagChip>
      )}
      {entry.constant && <FlagChip tone="accent">Constant</FlagChip>}
      {entry.excludeRecursion && <FlagChip>Non-recursable</FlagChip>}
      {entry.preventRecursion && <FlagChip>Prevent further</FlagChip>}
      {entry.delayUntilRecursion && <FlagChip>Delay until recursion</FlagChip>}
    </>
  );
}
