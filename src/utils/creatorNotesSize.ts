const EMBEDDED_IMAGE = /data:image\/[\w.+-]+[^"')\s]*/gi;

export interface CreatorNotesSize {
  bytes: number;
  embeddedImages: number;
  embeddedBytes: number;
}

export function measureCreatorNotes(text: string): CreatorNotesSize {
  let embeddedImages = 0;
  let embeddedBytes = 0;
  for (const match of text.matchAll(EMBEDDED_IMAGE)) {
    embeddedImages++;
    embeddedBytes += match[0].length;
  }
  return { bytes: new TextEncoder().encode(text).length, embeddedImages, embeddedBytes };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}
