import React from 'react';
import { DEFAULT_SPLIT_RATIO, clampSplitRatio } from './useCreatorNotesPreviewPrefs';

const SIDE_BY_SIDE_QUERY = '(min-width: 1024px)';
const KEYBOARD_STEP = 0.05;

interface SplitDividerProps {
  containerRef: React.RefObject<HTMLElement | null>;
  ratio: number;
  label: string;
  onDrag: (ratio: number) => void;
  onCommit: (ratio: number) => void;
}

function useSideBySide(): boolean {
  const [sideBySide, setSideBySide] = React.useState(() =>
    typeof window !== 'undefined' && window.matchMedia(SIDE_BY_SIDE_QUERY).matches,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(SIDE_BY_SIDE_QUERY);
    const onChange = () => setSideBySide(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return sideBySide;
}

/** Drag, arrow-key, or double-click (reset) divider between two flex panes. Matches the `lg` row/column switch. */
export function SplitDivider({ containerRef, ratio, label, onDrag, onCommit }: SplitDividerProps): React.ReactElement {
  const sideBySide = useSideBySide();

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const rect = container.getBoundingClientRect();
    let latest = ratio;

    try {
      handle.setPointerCapture(pointerId);
    } catch {
      // Capture keeps the drag alive over the preview iframe; without it the drag still works elsewhere.
    }
    document.body.style.cursor = sideBySide ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: PointerEvent) => {
      const next = sideBySide
        ? (ev.clientX - rect.left) / rect.width
        : (ev.clientY - rect.top) / rect.height;
      latest = clampSplitRatio(next);
      onDrag(latest);
    };

    const finish = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      handle.removeEventListener('lostpointercapture', finish);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onCommit(latest);
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
    handle.addEventListener('lostpointercapture', finish);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = ratio - KEYBOARD_STEP;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = ratio + KEYBOARD_STEP;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 1;
    if (next === null) return;
    event.preventDefault();
    onCommit(clampSplitRatio(next));
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={sideBySide ? 'vertical' : 'horizontal'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      title="Drag to resize · double-click to reset"
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => onCommit(DEFAULT_SPLIT_RATIO)}
      className="group flex shrink-0 touch-none items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-accent h-4 w-full cursor-row-resize lg:h-auto lg:w-4 lg:cursor-col-resize"
    >
      <div className="rounded-full bg-border transition-colors group-hover:bg-accent/60 group-active:bg-accent h-0.5 w-10 lg:h-10 lg:w-0.5" />
    </div>
  );
}

export default SplitDivider;
