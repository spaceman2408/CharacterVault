const REMOTE_REFERENCE_PATTERN =
  /(?:\bsrc|\bhref|\bbackground|\bposter)\s*=\s*["']?\s*(?:https?:)?\/\/|\bsrcset\s*=\s*["']?(?:[^"'>]*,)?\s*(?:https?:)?\/\/|(?:url|image-set)\(\s*["']?\s*(?:https?:)?\/\/|@import\s+(?:url\(\s*)?["']?\s*(?:https?:)?\/\//i;

const CSS_ESCAPE = /\\([0-9a-f]{1,6})[ \t\r\n\f]?|\\(.)/gi;

/**
 * Resolves HTML entities (through an inert parse) and CSS escapes, which could otherwise
 * spell a URL the pattern can't see, e.g. `src="&#104;ttps://…"` or `url(\68 ttps://…)`.
 */
function decodeForScan(content: string): string {
  const html =
    typeof DOMParser === 'undefined'
      ? content
      : new DOMParser().parseFromString(content, 'text/html').documentElement.outerHTML;
  return html.replace(CSS_ESCAPE, (_match, hex: string | undefined, char: string | undefined) => {
    if (hex === undefined) return char ?? '';
    const code = parseInt(hex, 16);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '�';
  });
}

/** True when Creator Notes HTML/CSS references a resource on another host. */
export function hasRemoteReference(content: string): boolean {
  return REMOTE_REFERENCE_PATTERN.test(content) || REMOTE_REFERENCE_PATTERN.test(decodeForScan(content));
}
