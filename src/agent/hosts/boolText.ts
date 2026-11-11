const TRUE_WORDS = new Set(['true', 'yes', 'on', '1']);
const FALSE_WORDS = new Set(['false', 'no', 'off', '0']);

export function parseBoolText(raw: string | undefined): boolean | null {
  const word = (raw ?? '').trim().replace(/^(["'])(.*)\1$/, '$2').trim().toLowerCase();
  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;
  return null;
}
