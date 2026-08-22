const COMPACT_AFTER = 32;

/** Append-only string that avoids quadratic `+=` on a growing stream. */
export class ChunkString {
  private head = '';
  private parts: string[] = [];
  private extraLen = 0;

  append(text: string): void {
    if (!text) return;
    this.parts.push(text);
    this.extraLen += text.length;
    if (this.parts.length >= COMPACT_AFTER) this.compact();
  }

  toString(): string {
    this.compact();
    return this.head;
  }

  /** Bytes after `start` without compacting the whole buffer. */
  sliceFrom(start: number): string {
    const total = this.length;
    if (start <= 0) return this.toString();
    if (start >= total) return '';
    let skip = start;
    const out: string[] = [];
    const take = (piece: string) => {
      if (!piece) return;
      if (skip >= piece.length) {
        skip -= piece.length;
        return;
      }
      out.push(skip > 0 ? piece.slice(skip) : piece);
      skip = 0;
    };
    take(this.head);
    for (const part of this.parts) take(part);
    return out.join('');
  }

  clear(): void {
    this.head = '';
    this.parts = [];
    this.extraLen = 0;
  }

  get length(): number {
    return this.head.length + this.extraLen;
  }

  tail(maxChars: number): string {
    if (maxChars <= 0) return '';
    if (this.length <= maxChars) return this.toString();
    return `…${this.sliceFrom(this.length - maxChars)}`;
  }

  private compact(): void {
    if (this.parts.length === 0) return;
    this.head = this.head ? this.head + this.parts.join('') : this.parts.join('');
    this.parts = [];
    this.extraLen = 0;
  }
}
