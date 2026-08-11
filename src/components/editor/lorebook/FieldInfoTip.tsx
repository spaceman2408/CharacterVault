import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';

const TIP_WIDTH = 256;
const VIEWPORT_PAD = 8;
const EST_TIP_HEIGHT = 120;

/**
 * Compact help control for form labels (hover / focus / click).
 * Tooltip is portaled to document.body so sidebar overflow / editor stacking
 * cannot clip it.
 */
export function FieldInfoTip({
  text,
  label = 'About this field',
  side = 'right',
}: {
  text: string;
  label?: string;
  side?: 'left' | 'right';
}): React.ReactElement {
  const tipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const placeNearButton = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn || !isMountedRef.current) return;
    const rect = btn.getBoundingClientRect();

    let left = side === 'right' ? rect.left : rect.right - TIP_WIDTH;
    left = Math.max(
      VIEWPORT_PAD,
      Math.min(left, window.innerWidth - TIP_WIDTH - VIEWPORT_PAD),
    );

    let top = rect.bottom + 6;
    if (top + EST_TIP_HEIGHT > window.innerHeight - VIEWPORT_PAD) {
      top = Math.max(VIEWPORT_PAD, rect.top - EST_TIP_HEIGHT - 6);
    }

    setCoords({ top, left });
  }, [side]);

  const openTip = () => {
    clearCloseTimer();
    placeNearButton();
    if (isMountedRef.current) setOpen(true);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      if (isMountedRef.current) setOpen(false);
    }, 120);
  };

  useEffect(() => {
    if (!open) return;
    const onReposition = () => placeNearButton();
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [open, placeNearButton]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearCloseTimer();
    };
  }, []);

  const tooltip =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <span
        id={tipId}
        role="tooltip"
        onMouseEnter={openTip}
        onMouseLeave={scheduleClose}
        className="pointer-events-auto fixed z-9999 w-56 rounded-lg border border-border bg-surface p-2 text-left text-[11px] leading-snug text-fg shadow-xl sm:w-64"
        style={{ top: coords.top, left: coords.left }}
      >
        {text}
      </span>,
      document.body,
    );

  return (
    <span className="inline-flex shrink-0 align-middle">
      <button
        ref={buttonRef}
        type="button"
        className="rounded p-0.5 text-fg-subtle transition-colors hover:bg-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        aria-label={label}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onMouseEnter={openTip}
        onMouseLeave={scheduleClose}
        onFocus={openTip}
        onBlur={scheduleClose}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) {
            setOpen(false);
          } else {
            openTip();
          }
        }}
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      {tooltip}
    </span>
  );
}

export function FieldLabel({
  children,
  help,
  helpLabel,
  className = 'mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-fg-subtle',
}: {
  children: React.ReactNode;
  help?: string;
  helpLabel?: string;
  className?: string;
}): React.ReactElement {
  return (
    <div className={className}>
      <span>{children}</span>
      {help ? <FieldInfoTip text={help} label={helpLabel ?? `About ${String(children)}`} /> : null}
    </div>
  );
}
