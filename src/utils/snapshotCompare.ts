/** JSON with sorted keys and undefined properties dropped, so equal values serialize equally. */
export function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableSerialize(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  for (const key in record) {
    if (Object.hasOwn(record, key) && !isEmptyValue(record[key])) return false;
  }
  return true;
}

function textMatches(left: string, right: string): boolean {
  if (!left.includes('\r') && !right.includes('\r')) return false;
  return left.replace(/\r\n?/g, '\n') === right.replace(/\r\n?/g, '\n');
}

/**
 * Whether two snapshot values would look the same to the user: missing,
 * null, '', [] and {} all read as empty, and CRLF reads as LF. Without this a
 * field that went from undefined to '' counts as changed but has nothing to
 * show in the diff. Walks both values in place and stops at the first
 * difference; whole lorebooks go through here, so it must not copy them.
 */
export function snapshotValuesMatch(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  const leftEmpty = isEmptyValue(left);
  const rightEmpty = isEmptyValue(right);
  if (leftEmpty || rightEmpty) return leftEmpty && rightEmpty;
  if (typeof left === 'string' && typeof right === 'string') return textMatches(left, right);
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!snapshotValuesMatch(left[index], right[index])) return false;
    }
    return true;
  }
  if (typeof left !== 'object' || typeof right !== 'object') return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  for (const key in leftRecord) {
    if (Object.hasOwn(leftRecord, key) && !snapshotValuesMatch(leftRecord[key], rightRecord[key])) return false;
  }
  for (const key in rightRecord) {
    if (Object.hasOwn(rightRecord, key) && !Object.hasOwn(leftRecord, key) && !isEmptyValue(rightRecord[key])) {
      return false;
    }
  }
  return true;
}
