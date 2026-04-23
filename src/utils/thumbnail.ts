/**
 * @fileoverview Thumbnail generation utility for character images.
 * @module @utils/thumbnail
 */

const THUMBNAIL_MAX_WIDTH = 128;
const THUMBNAIL_MAX_HEIGHT = 192;
const THUMBNAIL_QUALITY = 0.7; // JPEG quality

/**
 * Generate a thumbnail from an image data URL.
 * Creates a small JPEG (128x192 max) for efficient display in the vault view.
 * @param imageDataUrl - The full-resolution image data URL (base64)
 * @returns Promise resolving to the thumbnail data URL (JPEG base64)
 */
export async function generateThumbnail(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(
        THUMBNAIL_MAX_WIDTH / img.naturalWidth,
        THUMBNAIL_MAX_HEIGHT / img.naturalHeight,
        1 // never upscale
      );
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY));
    };
    img.onerror = reject;
    img.src = imageDataUrl;
  });
}
