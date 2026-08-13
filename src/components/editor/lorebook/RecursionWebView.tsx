/**
 * SVG web view of the recursion graph: nodes laid out per connected component
 * (BFS layers via recursionGraph helpers), edges with arrowheads, pan/zoom,
 * hover link highlighting, click-to-inspect and ctrl-click multi-select.
 * The list view remains the accessible equivalent; every action here
 * (inspect / select) mirrors one available in list mode.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, MousePointerClick } from 'lucide-react';
import type { LorebookEntry } from '../../../db/characterTypes';
import type { RecursionGraph } from './recursionGraph';
import { entryDisplayName, getConnectedComponents, layerComponent, listEdges } from './recursionGraph';

const NODE_W = 148;
const NODE_H = 40;
const COL_GAP = 64;
const ROW_GAP = 22;
const COMP_GAP = 72;
const COMP_PAD = 28;
const STANDALONE_ROW_GAP = 16;

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

type NodePos = { x: number; y: number; componentIndex: number };

type Layout = {
  pos: Map<number, NodePos>;
  bounds: { width: number; height: number };
  clusters: { componentIndex: number; label: string; x: number; y: number }[];
  standaloneCount: number;
};

function truncateLabel(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function computeLayout(
  entries: LorebookEntry[],
  graph: RecursionGraph,
  showStandalone: boolean,
): Layout {
  const pos = new Map<number, NodePos>();
  const clusters: Layout['clusters'] = [];
  const components = getConnectedComponents(entries, graph);
  const linked = components.filter((c) => c.edges.length > 0);
  const standalone = components.filter((c) => c.edges.length === 0);

  let cursorX = 0;
  let linkedBottom = 0;

  linked.forEach((component, componentIndex) => {
    const layers = layerComponent(component.entryIds, graph);
    const nodeCount = component.entryIds.length;
    layers.forEach((layer, layerIdx) => {
      layer.forEach((id, rowIdx) => {
        pos.set(id, {
          x: cursorX + layerIdx * (NODE_W + COL_GAP),
          y: rowIdx * (NODE_H + ROW_GAP),
          componentIndex,
        });
      });
    });
    const compWidth = layers.length * NODE_W + Math.max(0, layers.length - 1) * COL_GAP;
    let compHeight = 0;
    for (const layer of layers) {
      const h = layer.length * NODE_H + Math.max(0, layer.length - 1) * ROW_GAP;
      if (h > compHeight) compHeight = h;
    }
    if (compHeight > linkedBottom) linkedBottom = compHeight;
    clusters.push({
      componentIndex,
      label: `Cluster of ${nodeCount}`,
      x: cursorX,
      y: compHeight + 14,
    });
    cursorX += compWidth + COMP_GAP;
  });

  // Back-link arcs rise above the top row; reserve headroom so auto-fit shows them.
  let arcPad = 0;
  for (const [fromId, outs] of graph.outgoing) {
    const from = pos.get(fromId);
    if (!from) continue;
    for (const edge of outs) {
      const to = pos.get(edge.toId);
      if (!to || to.x >= from.x) continue;
      arcPad = Math.max(arcPad, backArcRise(from.x - to.x) + 72);
    }
  }
  if (arcPad > 0) {
    for (const p of pos.values()) p.y += arcPad;
    for (const cluster of clusters) cluster.y += arcPad;
    linkedBottom += arcPad;
  }

  if (linked.length > 0) linkedBottom += COMP_PAD;

  let boundsWidth = linked.length > 0 ? cursorX - COMP_GAP : 0;
  let boundsHeight = linkedBottom;

  let standaloneCount = 0;
  if (showStandalone && standalone.length > 0) {
    const ids = standalone.map((c) => c.entryIds[0]).sort((a, b) => a - b);
    const cols = Math.max(2, Math.min(6, Math.ceil(Math.sqrt(ids.length))));
    ids.forEach((id, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (NODE_W + COL_GAP);
      const y = linkedBottom + 24 + row * (NODE_H + STANDALONE_ROW_GAP);
      pos.set(id, { x, y, componentIndex: -1 });
      standaloneCount += 1;
      const right = x + NODE_W;
      const bottom = y + NODE_H;
      if (right > boundsWidth) boundsWidth = right;
      if (bottom > boundsHeight) boundsHeight = bottom;
    });
  } else {
    standaloneCount = standalone.length;
  }

  return {
    pos,
    bounds: { width: Math.max(boundsWidth, 1), height: Math.max(boundsHeight, 1) },
    clusters,
    standaloneCount,
  };
}

function backArcRise(span: number): number {
  return Math.max(34, Math.min(120, span * 0.3));
}

const BACK_EDGE_SPACING = 11;
const BACK_EDGE_BUMP = 14;
// Fan endpoints stay on the node's top edge, and total rise staggering stays
// under the headroom computeLayout reserves (rise + MAX_BUMP_SPAN < pad).
const BACK_EDGE_FAN_WIDTH = NODE_W - 24;
const BACK_EDGE_MAX_BUMP_SPAN = 66;

type BackEdgeMeta = { startDx: number; endDx: number; bump: number };

function edgePath(from: NodePos, to: NodePos, meta?: BackEdgeMeta): string {
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;

  // Back link (target in a column left of the source): a side-to-side cubic
  // degenerates into a straight line overshooting both nodes, so draw a
  // loop-back arch instead — off the top of the source, over the row, and
  // down into the top of the target (arrowhead points down). Parallel arches
  // get fanned horizontally and staggered vertically so each stays traceable.
  if (to.x < from.x) {
    const fromCx = from.x + NODE_W / 2 + (meta?.startDx ?? 0);
    const toCx = to.x + NODE_W / 2 + (meta?.endDx ?? 0);
    const apexY =
      Math.min(from.y, to.y) - backArcRise(from.x - to.x) - (meta?.bump ?? 0);
    return `M ${fromCx} ${from.y} C ${fromCx} ${apexY}, ${toCx} ${apexY}, ${toCx} ${to.y}`;
  }

  const dx = Math.max(24, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export type RecursionWebViewProps = {
  entries: LorebookEntry[];
  graph: RecursionGraph;
  indexById: Map<number, number>;
  inspectedId: number | null;
  selectedIds: Set<number>;
  showStandalone: boolean;
  onToggleShowStandalone: (value: boolean) => void;
  onInspect: (id: number) => void;
  onToggleSelect: (id: number) => void;
};

export function RecursionWebView({
  entries,
  graph,
  indexById,
  inspectedId,
  selectedIds,
  showStandalone,
  onToggleShowStandalone,
  onInspect,
  onToggleSelect,
}: RecursionWebViewProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ x: 16, y: 16, k: 1 });
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);

  // Identity (which entries exist + standalone visibility) vs full topology
  // (plus which edges exist). Flag-only edits change neither. Key edits change
  // edges and must relayout, but must not yank the camera.
  const entryIdentityKey = useMemo(
    () =>
      `${showStandalone ? 1 : 0}:${entries
        .map((e) => e.id)
        .sort((a, b) => a - b)
        .join(',')}`,
    [entries, showStandalone],
  );
  const topologyKey = useMemo(() => {
    const edgePairs: string[] = [];
    for (const [fromId, outs] of graph.outgoing) {
      for (const edge of outs) edgePairs.push(`${fromId}>${edge.toId}`);
    }
    edgePairs.sort();
    return `${entryIdentityKey}|${edgePairs.join(',')}`;
  }, [entryIdentityKey, graph]);

  const layout = useMemo(
    () => computeLayout(entries, graph, showStandalone),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topologyKey],
  );
  const edges = useMemo(() => listEdges(graph), [graph]);
  const backEdgeMeta = useMemo(() => {
    const bySource = new Map<number, string[]>();
    const byTarget = new Map<number, string[]>();
    for (const edge of edges) {
      const from = layout.pos.get(edge.fromId);
      const to = layout.pos.get(edge.toId);
      if (!from || !to || to.x >= from.x) continue;
      const key = `${edge.fromId}->${edge.toId}`;
      const s = bySource.get(edge.fromId);
      if (s) s.push(key);
      else bySource.set(edge.fromId, [key]);
      const t = byTarget.get(edge.toId);
      if (t) t.push(key);
      else byTarget.set(edge.toId, [key]);
    }
    const meta = new Map<string, BackEdgeMeta>();
    for (const group of bySource.values()) {
      group.sort();
      const spacing = Math.min(
        BACK_EDGE_SPACING,
        BACK_EDGE_FAN_WIDTH / Math.max(1, group.length - 1),
      );
      group.forEach((key, i) => {
        const m = meta.get(key) ?? { startDx: 0, endDx: 0, bump: 0 };
        m.startDx = (i - (group.length - 1) / 2) * spacing;
        meta.set(key, m);
      });
    }
    for (const group of byTarget.values()) {
      group.sort();
      const spacing = Math.min(
        BACK_EDGE_SPACING,
        BACK_EDGE_FAN_WIDTH / Math.max(1, group.length - 1),
      );
      const bumpStep = Math.min(
        BACK_EDGE_BUMP,
        BACK_EDGE_MAX_BUMP_SPAN / Math.max(1, group.length - 1),
      );
      group.forEach((key, i) => {
        const m = meta.get(key) ?? { startDx: 0, endDx: 0, bump: 0 };
        m.endDx = (i - (group.length - 1) / 2) * spacing;
        m.bump = i * bumpStep;
        meta.set(key, m);
      });
    }
    return meta;
  }, [edges, layout]);
  const entryById = useMemo(() => {
    const map = new Map<number, LorebookEntry>();
    for (const e of entries) map.set(e.id, e);
    return map;
  }, [entries]);

  const fitView = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const { clientWidth, clientHeight } = svg;
    if (clientWidth === 0 || clientHeight === 0) return;
    const { width, height } = layout.bounds;
    const k = Math.max(
      MIN_ZOOM,
      Math.min(1, (clientWidth - 48) / width, (clientHeight - 48) / height),
    );
    setView({
      k,
      x: (clientWidth - width * k) / 2,
      y: (clientHeight - height * k) / 2,
    });
  }, [layout]);

  const fitViewRef = useRef(fitView);
  useEffect(() => {
    fitViewRef.current = fitView;
  });

  // Auto-fit when the entry set or standalone visibility changes, not when
  // only edges change (key edits). Reset view / resize still fit explicitly.
  const fitTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (fitTokenRef.current === entryIdentityKey) return;
    fitTokenRef.current = entryIdentityKey;
    fitViewRef.current();
  }, [entryIdentityKey]);

  // Keep the fit when the container is resized. fitView identity changes on
  // every key-driven relayout; observe once and call through the ref so we
  // do not allocate a new ResizeObserver per edit.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        fitViewRef.current();
      });
    });
    ro.observe(svg);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // Native wheel listener: React's synthetic onWheel cannot preventDefault reliably.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setView((prev) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.k * factor));
        const scale = k / prev.k;
        return {
          k,
          x: px - (px - prev.x) * scale,
          y: py - (py - prev.y) * scale,
        };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('[data-node]')) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: view.x,
      baseY: view.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (drag.moved) {
      setView((prev) => ({ ...prev, x: drag.baseX + dx, y: drag.baseY + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  };

  // Pointer capture retargets the click after a background pan, so node
  // clicks only fire for genuine presses on the node itself.
  const handleNodeActivate = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent, id: number) => {
      if ('ctrlKey' in e && (e.ctrlKey || e.metaKey)) onToggleSelect(id);
      else onInspect(id);
    },
    [onInspect, onToggleSelect],
  );

  // Pathway highlighting pins to the inspected node; hovering another node
  // temporarily takes over, falling back to the inspected node on mouse-out.
  const highlightId = hoveredId ?? inspectedId;

  const highlightedNeighborIds = useMemo(() => {
    if (highlightId == null) return null;
    const set = new Set<number>([highlightId]);
    for (const edge of edges) {
      if (edge.fromId === highlightId) set.add(edge.toId);
      if (edge.toId === highlightId) set.add(edge.fromId);
    }
    return set;
  }, [highlightId, edges]);

  const dimmed = highlightedNeighborIds != null;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/10">
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-border bg-surface/90 px-2.5 py-1.5 text-[10px] leading-snug text-fg-subtle shadow-sm backdrop-blur-sm">
        <span className="inline-flex items-center gap-1">
          <MousePointerClick className="h-3 w-3" />
          Click inspects & pins paths · Ctrl-click selects · drag pans · scroll zooms
        </span>
      </div>
      <div className="absolute right-3 top-3 z-10 flex gap-1.5">
        <button
          type="button"
          onClick={() => onToggleShowStandalone(!showStandalone)}
          className="rounded-lg border border-border bg-surface/90 px-2.5 py-1.5 text-[10px] font-medium text-fg-muted shadow-sm backdrop-blur-sm hover:bg-hover hover:text-fg touch-manipulation"
          title="Standalone entries have no links; showing them can clutter the web"
        >
          {showStandalone ? 'Hide' : 'Show'} standalone ({layout.standaloneCount})
        </button>
        <button
          type="button"
          onClick={fitView}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface/90 px-2.5 py-1.5 text-[10px] font-medium text-fg-muted shadow-sm backdrop-blur-sm hover:bg-hover hover:text-fg touch-manipulation"
          title="Fit the whole web into view"
        >
          <Maximize2 className="h-3 w-3" />
          Reset view
        </button>
      </div>

      <svg
        ref={svgRef}
        role="img"
        aria-label="Recursion web: entries linked where one entry's content mentions another's keys"
        className="min-h-0 w-full flex-1 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <marker
            id="rec-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" className="fill-border-strong" />
          </marker>
          <marker
            id="rec-arrow-hot"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" className="fill-accent" />
          </marker>
        </defs>

        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {/* Edges under nodes */}
          {edges.map((edge) => {
            const from = layout.pos.get(edge.fromId);
            const to = layout.pos.get(edge.toId);
            if (!from || !to) return null;
            const hot =
              highlightId != null &&
              (edge.fromId === highlightId || edge.toId === highlightId);
            const fromEntry = entryById.get(edge.fromId);
            const toEntry = entryById.get(edge.toId);
            if (!fromEntry || !toEntry) return null;
            return (
              <path
                key={`${edge.fromId}->${edge.toId}`}
                d={edgePath(from, to, backEdgeMeta.get(`${edge.fromId}->${edge.toId}`))}
                fill="none"
                markerEnd={hot ? 'url(#rec-arrow-hot)' : 'url(#rec-arrow)'}
                className={`transition-opacity ${
                  hot ? 'stroke-accent' : 'stroke-border-strong'
                } ${dimmed && !hot ? 'opacity-15' : 'opacity-70'}`}
                strokeWidth={hot ? 2 : 1.25}
              >
                <title>
                  {entryDisplayName(fromEntry, indexById.get(edge.fromId))} →{' '}
                  {entryDisplayName(toEntry, indexById.get(edge.toId))} via{' '}
                  {edge.matchedKeys.join(', ')}
                </title>
              </path>
            );
          })}

          {/* Cluster captions */}
          {layout.clusters.map((cluster) => (
            <text
              key={`cluster-${cluster.componentIndex}`}
              x={cluster.x}
              y={cluster.y}
              className="fill-fg-subtle text-[11px]"
            >
              {cluster.label}
            </text>
          ))}

          {/* Nodes */}
          {entries.map((entry) => {
            const p = layout.pos.get(entry.id);
            if (!p) return null;
            const isHovered = hoveredId === entry.id;
             const isNeighbor = highlightedNeighborIds?.has(entry.id) ?? false;
            const isDim = dimmed && !isNeighbor;
            const isInspected = inspectedId === entry.id;
            const isSelected = selectedIds.has(entry.id);
            return (
              <g
                key={entry.id}
                data-node
                transform={`translate(${p.x},${p.y})`}
                className={`cursor-pointer outline-none transition-opacity focus-visible:outline-none ${isDim ? 'opacity-25' : ''}`}
                onClick={(e) => handleNodeActivate(e, entry.id)}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => setHoveredId((h) => (h === entry.id ? null : h))}
                onFocus={() => setHoveredId(entry.id)}
                onBlur={() => setHoveredId((h) => (h === entry.id ? null : h))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNodeActivate(e, entry.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-pressed={isInspected}
                aria-label={`Entry ${entryDisplayName(entry, indexById.get(entry.id))}. Click to inspect, Ctrl-click to select.`}
              >
                <title>{entryDisplayName(entry, indexById.get(entry.id))}</title>
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  strokeWidth={isSelected ? 2.5 : isInspected ? 2 : 1.25}
                  className={`${
                    isSelected
                      ? 'fill-accent-soft stroke-accent'
                      : isInspected
                        ? 'fill-accent-soft/40 stroke-accent/60'
                        : isHovered
                          ? 'fill-surface stroke-accent/60'
                          : p.componentIndex === -1
                            ? 'fill-muted/60 stroke-border'
                            : 'fill-surface stroke-border'
                  } ${!entry.enabled ? 'opacity-60' : ''}`}
                />
                <text
                  x={10}
                  y={flagsPresent(entry) ? 16 : NODE_H / 2 + 4}
                  className={`fill-fg text-[11px] font-medium select-none ${
                    p.componentIndex === -1 ? 'opacity-70' : ''
                  }`}
                >
                  {truncateLabel(entryDisplayName(entry, indexById.get(entry.id)), 18)}
                </text>
                <NodeFlagDots entry={entry} present={flagsPresent(entry)} />
              </g>
            );
          })}

          {/* Back-link origin ports, above nodes so a partly-hidden arch's source stays visible */}
          {edges.map((edge) => {
            const from = layout.pos.get(edge.fromId);
            const to = layout.pos.get(edge.toId);
            if (!from || !to || to.x >= from.x) return null;
            const meta = backEdgeMeta.get(`${edge.fromId}->${edge.toId}`);
            const cx = from.x + NODE_W / 2 + (meta?.startDx ?? 0);
            const hot =
              highlightId != null &&
              (edge.fromId === highlightId || edge.toId === highlightId);
            return (
              <circle
                key={`port-${edge.fromId}->${edge.toId}`}
                cx={cx}
                cy={from.y}
                r={3}
                className={`transition-opacity ${
                  hot ? 'fill-accent' : 'fill-border-strong'
                } ${dimmed && !hot ? 'opacity-15' : 'opacity-90'}`}
              />
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface/70 px-3 py-1.5 text-[10px] text-fg-subtle">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-border-strong" aria-hidden />
          <span aria-hidden>→</span>
          content mentions keys → can activate
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
          Non-recursable
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-success" aria-hidden />
          Prevent further recursion
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-fg-subtle" aria-hidden />
          Delay until recursion
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-warning" aria-hidden />
          Disabled
        </span>
      </div>
    </div>
  );
}

function flagsPresent(entry: LorebookEntry): boolean {
  return Boolean(
    entry.excludeRecursion || entry.preventRecursion || entry.delayUntilRecursion || !entry.enabled,
  );
}

function NodeFlagDots({ entry, present }: { entry: LorebookEntry; present: boolean }): React.ReactElement | null {
  if (!present) return null;
  const dots: { className: string; title: string }[] = [];
  if (entry.excludeRecursion)
    dots.push({ className: 'fill-accent', title: 'Non-recursable: nothing unlocks it' });
  if (entry.preventRecursion)
    dots.push({ className: 'fill-success', title: 'Prevent further recursion: chain stops here' });
  if (entry.delayUntilRecursion)
    dots.push({ className: 'fill-fg-subtle', title: 'Delay until recursion' });
  if (!entry.enabled) dots.push({ className: 'fill-warning', title: 'Disabled' });
  return (
    <g transform={`translate(${NODE_W - 8 - dots.length * 11},${NODE_H - 10})`}>
      {dots.map((dot, i) => (
        <circle key={dot.title} cx={i * 11} cy={0} r={3.5} className={dot.className}>
          <title>{dot.title}</title>
        </circle>
      ))}
    </g>
  );
}
