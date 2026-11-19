import { RangeSetBuilder, Transaction, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';

const CSS_CONTEXT = /<style\b[^>]*>([\s\S]*?)<\/style>|\bstyle\s*=\s*("([^"]*)"|'([^']*)')/gi;
const COLOR = /#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{3,4})(?![\w-])|\b(?:rgba?|hsla?)\([^()]*\)/gi;

export interface ColorMatch {
  from: number;
  to: number;
  color: string;
}

/** Colors inside `<style>` blocks and `style=""` attributes, with absolute offsets. */
export function findCssColors(doc: string): ColorMatch[] {
  const matches: ColorMatch[] = [];
  for (const context of doc.matchAll(CSS_CONTEXT)) {
    const body = context[1] ?? context[3] ?? context[4] ?? '';
    const offset = context[1] !== undefined ? context[0].indexOf('>') + 1 : context[0].indexOf(context[2]) + 1;
    const bodyStart = context.index + offset;
    for (const color of body.matchAll(COLOR)) {
      matches.push({ from: bodyStart + color.index, to: bodyStart + color.index + color[0].length, color: color[0] });
    }
  }
  return matches;
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(color: string): Rgba | null {
  if (typeof document === 'undefined') return null;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  const normalized = String(ctx.fillStyle);
  const hex = normalized.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (hex) return { r: parseInt(hex[1], 16), g: parseInt(hex[2], 16), b: parseInt(hex[3], 16), a: 1 };
  const rgba = normalized.match(/^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/i);
  if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] === undefined ? 1 : +rgba[4] };
  return null;
}

const toHexByte = (n: number) => Math.round(n).toString(16).padStart(2, '0');

function rgbToHsl({ r, g, b }: Rgba): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  h *= 60;
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function alphaOf(color: string): number {
  const lower = color.toLowerCase();
  if (lower.startsWith('#')) {
    const digits = lower.slice(1);
    if (digits.length === 4) return parseInt(digits[3] + digits[3], 16) / 255;
    if (digits.length === 8) return parseInt(digits.slice(6), 16) / 255;
    return 1;
  }
  const parts = lower.slice(lower.indexOf('(') + 1, lower.lastIndexOf(')')).split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 4) return 1;
  const raw = parts[3];
  const value = raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

/** Writes the picked `#rrggbb` back in the original color's notation, keeping its alpha. */
export function replaceColorKeepingFormat(original: string, pickedHex: string): string {
  const hex = pickedHex.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!hex) return original;
  const picked: Rgba = { r: parseInt(hex[1], 16), g: parseInt(hex[2], 16), b: parseInt(hex[3], 16), a: 1 };
  const alpha = Math.round(alphaOf(original) * 1000) / 1000;
  const lower = original.toLowerCase();

  if (lower.startsWith('#')) {
    const base = `#${toHexByte(picked.r)}${toHexByte(picked.g)}${toHexByte(picked.b)}`;
    if (original.length === 9 || original.length === 5) return base + toHexByte(alpha * 255);
    return base;
  }
  if (lower.startsWith('hsl')) {
    const [h, s, l] = rgbToHsl(picked);
    return alpha < 1 || lower.startsWith('hsla') ? `hsla(${h}, ${s}%, ${l}%, ${alpha})` : `hsl(${h}, ${s}%, ${l}%)`;
  }
  return alpha < 1 || lower.startsWith('rgba')
    ? `rgba(${picked.r}, ${picked.g}, ${picked.b}, ${alpha})`
    : `rgb(${picked.r}, ${picked.g}, ${picked.b})`;
}

function toPickerHex(color: string): string {
  const rgba = parseColor(color);
  return rgba ? `#${toHexByte(rgba.r)}${toHexByte(rgba.g)}${toHexByte(rgba.b)}` : '#000000';
}

function openPicker(view: EditorView, from: number, anchor: HTMLElement): void {
  const startColor = view.state.doc.sliceString(from, view.state.doc.lineAt(from).to).match(COLOR)?.[0];
  if (!startColor) return;
  const original = startColor;
  let current = original;

  const input = document.createElement('input');
  input.type = 'color';
  input.value = toPickerHex(original);
  const rect = anchor.getBoundingClientRect();
  Object.assign(input.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.bottom}px`,
    width: '1px',
    height: '1px',
    opacity: '0',
    pointerEvents: 'none',
  });
  document.body.appendChild(input);

  const replace = (text: string, addToHistory: boolean) => {
    view.dispatch({
      changes: { from, to: from + current.length, insert: text },
      annotations: addToHistory ? undefined : Transaction.addToHistory.of(false),
      userEvent: 'input.color',
    });
    current = text;
  };

  // Live updates stay out of undo history; on close, the whole pick becomes one undo step.
  const onInput = () => replace(replaceColorKeepingFormat(original, input.value), false);
  const onChange = () => {
    const finalText = replaceColorKeepingFormat(original, input.value);
    replace(original, false);
    if (finalText !== original) replace(finalText, true);
    cleanup();
  };
  const cleanup = () => {
    input.removeEventListener('input', onInput);
    input.removeEventListener('change', onChange);
    input.remove();
  };
  input.addEventListener('input', onInput);
  input.addEventListener('change', onChange);
  input.addEventListener('blur', () => window.setTimeout(() => input.isConnected && cleanup(), 300));

  try {
    input.showPicker();
  } catch {
    input.click();
  }
}

class SwatchWidget extends WidgetType {
  readonly color: string;

  constructor(color: string) {
    super();
    this.color = color;
  }

  eq(other: SwatchWidget): boolean {
    return other.color === this.color;
  }

  toDOM(view: EditorView): HTMLElement {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'cm-color-swatch';
    swatch.title = 'Pick color';
    swatch.setAttribute('aria-label', `Pick color, now ${this.color}`);
    swatch.style.setProperty('--swatch-color', this.color);
    swatch.addEventListener('mousedown', (event) => event.preventDefault());
    swatch.addEventListener('click', (event) => {
      event.preventDefault();
      openPicker(view, view.posAtDOM(swatch), swatch);
    });
    return swatch;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function buildSwatches(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { from: visibleFrom, to: visibleTo } = view.viewport;
  for (const match of findCssColors(view.state.doc.toString())) {
    if (match.to < visibleFrom || match.from > visibleTo) continue;
    builder.add(match.from, match.from, Decoration.widget({ widget: new SwatchWidget(match.color), side: -1 }));
  }
  return builder.finish();
}

const swatchPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildSwatches(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = buildSwatches(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const swatchTheme = EditorView.baseTheme({
  '.cm-color-swatch': {
    display: 'inline-block',
    width: '0.8em',
    height: '0.8em',
    margin: '0 0.3em 0 0',
    padding: '0',
    verticalAlign: '-0.05em',
    borderRadius: '3px',
    border: '1px solid rgba(127, 127, 127, 0.6)',
    cursor: 'pointer',
    background:
      'linear-gradient(var(--swatch-color), var(--swatch-color)), repeating-conic-gradient(#999 0% 25%, #fff 0% 50%) 0 0 / 6px 6px',
  },
});

/** Inline color swatches in Creator Notes CSS; click one to pick a new color. */
export function colorSwatches(): Extension {
  return [swatchPlugin, swatchTheme];
}
