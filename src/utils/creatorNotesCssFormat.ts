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

/** Formats the CSS inside every `<style>` block; markup outside them is left untouched. */
export function formatCreatorNotesCss(notes: string): string {
  return notes.replace(STYLE_BLOCK, (match, lineIndent: string | undefined, open: string, css: string, close: string) => {
    if (!css.trim()) return match;
    const indent = lineIndent ?? '';
    return `${indent}${open}\n${formatCss(css, indent + INDENT)}\n${indent}${close}`;
  });
}
