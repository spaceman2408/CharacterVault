const STYLE_BLOCK = /(^[ \t]*)?(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gim;
const INDENT = '  ';

/**
 * Pretty-prints CSS: one declaration per line, nested blocks indented. Strings, comments,
 * and parentheses (e.g. `url(data:...;base64,...)`) are kept intact. Emits no blank lines.
 */
export function formatCss(css: string, baseIndent = ''): string {
  const lines: string[] = [];
  let depth = 0;
  let buffer = '';
  let parenDepth = 0;
  let quote: string | null = null;

  const pad = () => baseIndent + INDENT.repeat(depth);
  const flush = (suffix = '') => {
    let text = buffer.replace(/\s+/g, ' ').trim();
    buffer = '';
    if (!text && !suffix) return;
    if (depth > 0 && suffix !== ' {') text = text.replace(/^([\w-]+)\s*:\s*/, '$1: ');
    lines.push(pad() + text + suffix);
  };

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];

    if (quote) {
      buffer += ch;
      if (ch === '\\' && i + 1 < css.length) buffer += css[++i];
      else if (ch === quote) quote = null;
      continue;
    }

    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const comment = css.slice(i, end === -1 ? css.length : end + 2);
      flush();
      const commentLines = comment.split('\n');
      const minIndent = Math.min(
        ...commentLines.slice(1).filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length),
      );
      commentLines.forEach((line, idx) => {
        const body = idx === 0 ? line.trim() : line.slice(Number.isFinite(minIndent) ? minIndent : 0).trimEnd();
        lines.push(pad() + (idx === 0 ? body : `${INDENT}${body}`.replace(/^\s+\*\//, ' */')));
      });
      i = end === -1 ? css.length : end + 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      buffer += ch;
      continue;
    }
    if (ch === '(') parenDepth++;
    if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);

    if (parenDepth === 0 && ch === '{') {
      flush(' {');
      depth++;
    } else if (parenDepth === 0 && ch === ';') {
      flush(';');
    } else if (parenDepth === 0 && ch === '}') {
      flush();
      depth = Math.max(0, depth - 1);
      lines.push(`${pad()}}`);
    } else {
      buffer += ch;
    }
  }
  flush();

  return lines.join('\n');
}

export interface CssFormatChange {
  from: number;
  to: number;
  insert: string;
}

/** One change per `<style>` block whose CSS formatting differs; markup outside them is untouched. */
export function creatorNotesCssFormatChanges(notes: string): CssFormatChange[] {
  const changes: CssFormatChange[] = [];
  for (const match of notes.matchAll(STYLE_BLOCK)) {
    const [whole, lineIndent, open, css, close] = match;
    if (!css.trim()) continue;
    const indent = lineIndent ?? '';
    const insert = `${indent}${open}\n${formatCss(css, indent + INDENT)}\n${indent}${close}`;
    if (insert !== whole) changes.push({ from: match.index, to: match.index + whole.length, insert });
  }
  return changes;
}

/** Formats the CSS inside every `<style>` block; markup outside them is left untouched. */
export function formatCreatorNotesCss(notes: string): string {
  let result = '';
  let last = 0;
  for (const change of creatorNotesCssFormatChanges(notes)) {
    result += notes.slice(last, change.from) + change.insert;
    last = change.to;
  }
  return result + notes.slice(last);
}
