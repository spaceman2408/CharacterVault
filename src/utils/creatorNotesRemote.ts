const REMOTE_REFERENCE_PATTERN =
  /(?:\bsrc|\bsrcset|\bhref)\s*=\s*["']?\s*(?:https?:)?\/\/|url\(\s*["']?\s*(?:https?:)?\/\/|@import\s+(?:url\(\s*)?["']?\s*(?:https?:)?\/\//i;

/** True when Creator Notes HTML/CSS references a resource on another host. */
export function hasRemoteReference(content: string): boolean {
  return REMOTE_REFERENCE_PATTERN.test(content);
}
