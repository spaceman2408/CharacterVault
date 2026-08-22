import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import type { ResponseStats } from '../types';

const STATS_TOOLTIP_MAX_WIDTH = 280;
const STATS_TOOLTIP_GAP = 8;
const STATS_TOOLTIP_VIEWPORT_PAD = 8;

function hasAnyStat(stats: ResponseStats): boolean {
  return (
    typeof stats.ttft === 'number' ||
    typeof stats.tokensPerSecond === 'number' ||
    !!stats.modelId ||
    !!stats.providerId
  );
}

export function StatsInfoButton({ stats }: { stats: ResponseStats }): React.ReactElement | null {
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
    const tooltipWidth = Math.min(
      STATS_TOOLTIP_MAX_WIDTH,
      Math.max(tooltipEl?.offsetWidth || 0, 120),
    );
    const tooltipHeight = tooltipEl?.offsetHeight || 80;

    const placeAbove =
      rect.top >= tooltipHeight + STATS_TOOLTIP_GAP + STATS_TOOLTIP_VIEWPORT_PAD;

    let top = placeAbove
      ? rect.top - STATS_TOOLTIP_GAP - tooltipHeight
      : rect.bottom + STATS_TOOLTIP_GAP;

    let left = rect.left;
    const maxLeft = window.innerWidth - tooltipWidth - STATS_TOOLTIP_VIEWPORT_PAD;
    left = Math.max(STATS_TOOLTIP_VIEWPORT_PAD, Math.min(left, maxLeft));

    top = Math.max(
      STATS_TOOLTIP_VIEWPORT_PAD,
      Math.min(top, window.innerHeight - tooltipHeight - STATS_TOOLTIP_VIEWPORT_PAD),
    );

    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const id = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(id);
  }, [isOpen, updatePosition, stats]);

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
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || tooltipRef.current?.contains(target)) {
        return;
      }
      setPinnedOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [pinnedOpen]);

  if (!hasAnyStat(stats)) return null;

  const tooltip = isOpen
    ? createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            top: coords?.top ?? -9999,
            left: coords?.left ?? -9999,
            maxWidth: STATS_TOOLTIP_MAX_WIDTH,
            zIndex: 9999,
            visibility: coords ? 'visible' : 'hidden',
          }}
          className="pointer-events-none rounded-lg border border-border bg-surface px-2.5 py-1.5 text-left text-xs leading-5 text-fg shadow-lg"
        >
          {typeof stats.ttft === 'number' && <div>TTFT: {stats.ttft}ms</div>}
          {typeof stats.tokensPerSecond === 'number' && (
            <div>Speed: {stats.tokensPerSecond.toFixed(2)} t/s</div>
          )}
          {stats.modelId && (
            <div className="break-all">
              <span className="text-fg-muted">Model: </span>
              {stats.modelId}
            </div>
          )}
          {stats.providerId && (
            <div className="break-all">
              <span className="text-fg-muted">Provider: </span>
              {stats.providerId}
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <span className="relative ml-1 inline-flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setPinnedOpen((prev) => !prev);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="rounded-full p-0.5 text-fg-subtle transition-colors hover:bg-hover hover:text-fg focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        aria-label="Response stats"
        aria-expanded={isOpen}
      >
        <Info className="h-3 w-3" />
      </button>
      {tooltip}
    </span>
  );
}
