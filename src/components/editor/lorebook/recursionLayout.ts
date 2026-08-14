/**
 * Pixel layout for the recursion web: BFS layers left-to-right, with tall
 * ranks wrapped into extra columns so a dense book fans out instead of
 * stacking into a single vertical strip.
 */

import type { LorebookEntry } from '../../../db/characterTypes';
import type { RecursionGraph } from './recursionGraph';
import { getConnectedComponents, layerComponent } from './recursionGraph';

export const NODE_W = 148;
export const NODE_H = 40;
export const ROW_GAP = 22;
/** Gap between wrap-columns of the same BFS rank. */
export const WRAP_COL_GAP = 40;
/** Gap between BFS ranks (next hop). */
export const LAYER_GAP = 72;
export const COMP_GAP = 72;
export const COMP_PAD = 28;
export const STANDALONE_COL_GAP = 64;
export const STANDALONE_ROW_GAP = 16;
/** Max nodes stacked in one column before the rank wraps right. */
export const MAX_LAYER_ROWS = 8;

export type NodePos = { x: number; y: number; componentIndex: number };

export type Layout = {
  pos: Map<number, NodePos>;
  bounds: { width: number; height: number };
  clusters: { componentIndex: number; label: string; x: number; y: number }[];
  standaloneCount: number;
};

/**
 * Split a rank into columns of at most maxRows, spreading leftovers evenly
 * so 17 nodes / 8 rows becomes 3 columns (6+6+5) rather than 8+8+1.
 */
export function wrapLayer(ids: readonly number[], maxRows: number): number[][] {
  if (ids.length === 0) return [];
  if (maxRows < 1 || ids.length <= maxRows) return [[...ids]];
  const colCount = Math.ceil(ids.length / maxRows);
  const rows = Math.ceil(ids.length / colCount);
  const cols: number[][] = Array.from({ length: colCount }, () => []);
  ids.forEach((id, i) => {
    cols[Math.floor(i / rows)].push(id);
  });
  return cols.filter((col) => col.length > 0);
}

export function backArcRise(span: number): number {
  return Math.max(34, Math.min(120, span * 0.3));
}

function barycenterSort(
  ids: number[],
  pos: Map<number, NodePos>,
  graph: RecursionGraph,
): number[] {
  const scored = ids.map((id) => {
    let sum = 0;
    let n = 0;
    for (const edge of graph.incoming.get(id) ?? []) {
      const p = pos.get(edge.fromId);
      if (!p) continue;
      sum += p.y;
      n += 1;
    }
    return { id, bary: n > 0 ? sum / n : Number.POSITIVE_INFINITY };
  });
  scored.sort((a, b) => a.bary - b.bary || a.id - b.id);
  return scored.map((s) => s.id);
}

function columnHeight(count: number): number {
  if (count <= 0) return 0;
  return count * NODE_H + (count - 1) * ROW_GAP;
}

export function computeLayout(
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
    const colPlacements: { ids: number[]; height: number }[] = [];
    let localX = 0;

    layers.forEach((layer, layerIdx) => {
      const ordered = barycenterSort(layer, pos, graph);
      const wrapped = wrapLayer(ordered, MAX_LAYER_ROWS);
      wrapped.forEach((col, colIdx) => {
        const x = cursorX + localX;
        const height = columnHeight(col.length);
        col.forEach((id, rowIdx) => {
          pos.set(id, {
            x,
            y: rowIdx * (NODE_H + ROW_GAP),
            componentIndex,
          });
        });
        colPlacements.push({ ids: col, height });
        const isLastCol = layerIdx === layers.length - 1 && colIdx === wrapped.length - 1;
        const gap = isLastCol ? 0 : colIdx === wrapped.length - 1 ? LAYER_GAP : WRAP_COL_GAP;
        localX += NODE_W + gap;
      });
    });

    const maxH = colPlacements.reduce((m, c) => Math.max(m, c.height), 0);
    for (const col of colPlacements) {
      const dy = (maxH - col.height) / 2;
      if (dy === 0) continue;
      for (const id of col.ids) {
        const p = pos.get(id);
        if (p) p.y += dy;
      }
    }

    if (maxH > linkedBottom) linkedBottom = maxH;
    clusters.push({
      componentIndex,
      label: `Cluster of ${component.entryIds.length}`,
      x: cursorX,
      y: maxH + 14,
    });
    cursorX += Math.max(localX, NODE_W) + COMP_GAP;
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
      const x = col * (NODE_W + STANDALONE_COL_GAP);
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
