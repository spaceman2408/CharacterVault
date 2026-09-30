const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function hasPngSignature(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < PNG_SIGNATURE.length) return false;
  const bytes = new Uint8Array(buffer, 0, PNG_SIGNATURE.length);
  return PNG_SIGNATURE.every((byte, i) => bytes[i] === byte);
}

/** Re-encode any browser-decodable image (JPEG, WebP, GIF, …) as PNG at full size. */
export async function convertImageToPng(imageDataUrl: string): Promise<ArrayBuffer> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read the character image'));
    image.src = imageDataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not convert the character image to PNG');
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not convert the character image to PNG');
  return blob.arrayBuffer();
}
