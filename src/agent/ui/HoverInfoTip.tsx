import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

const TIP_MAX_WIDTH = 280;
const TIP_GAP = 8;
const TIP_PAD = 8;

export function HoverInfoTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isOpen = hovered || pinnedOpen;

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;
    const tooltipWidth = Math.min(TIP_MAX_WIDTH, Math.max(tooltipEl?.offsetWidth || 0, 120));
    const tooltipHeight = tooltipEl?.offsetHeight || 80;
    const placeAbove = rect.top >= tooltipHeight + TIP_GAP + TIP_PAD;

    let top = placeAbove ? rect.top - TIP_GAP - tooltipHeight : rect.bottom + TIP_GAP;
    let left = rect.left;
    const maxLeft = window.innerWidth - tooltipWidth - TIP_PAD;
    left = Math.max(TIP_PAD, Math.min(left, maxLeft));
    top = Math.max(TIP_PAD, Math.min(top, window.innerHeight - tooltipHeight - TIP_PAD));

    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const id = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(id);
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onReposition = () => updatePosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!pinnedOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || tooltipRef.current?.contains(target)) {
        return;
      }
      setPinnedOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [pinnedOpen]);

  const tooltip = isOpen
    ? createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            top: coords?.top ?? -9999,
            left: coords?.left ?? -9999,
            maxWidth: TIP_MAX_WIDTH,
            zIndex: 9999,
            visibility: coords ? 'visible' : 'hidden',
          }}
          className="pointer-events-none rounded-lg border border-border bg-surface px-2.5 py-1.5 text-left text-xs leading-5 text-fg shadow-lg"
        >
          {children}
        </div>,
        document.body,
      )
    : null;

  return (
    <span className="relative inline-flex shrink-0 items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setPinnedOpen((prev) => !prev);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="rounded-full p-0.5 text-danger transition-colors hover:bg-danger-soft focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        aria-label={label}
        aria-expanded={isOpen}
      >
        <Info className="h-3 w-3" />
      </button>
      {tooltip}
    </span>
  );
}
