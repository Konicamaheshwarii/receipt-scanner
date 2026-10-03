/** Scales (w, h) down to fit inside `max` on the long edge, never up. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export interface PreparedImage {
  /** Compressed JPEG data URL sent to the model and shown on the review screen (memory only). */
  dataUrl: string;
  /** Base64 part of dataUrl. */
  base64: string;
  mimeType: 'image/jpeg';
  /** Small JPEG data URL that is stored with the expense. */
  thumbnail: string;
  width: number;
  height: number;
  /** Approximate size of the upload in bytes. */
  bytes: number;
}

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

async function decode(source: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(source, { imageOrientation: 'from-image' });
    } catch {
      // fall back to <img> (e.g. some HEIC/older browsers)
    }
  }
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error('This image could not be opened. Try a JPEG or PNG photo.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function render(img: ImageBitmap | HTMLImageElement, max: number, quality: number) {
  const w = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const h = 'naturalHeight' in img ? img.naturalHeight : img.height;
  const size = fitWithin(w, h, max);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // transparent PNGs become white, not black, as JPEG
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(img, 0, 0, size.width, size.height);
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), ...size };
}

/**
 * Downscales and re-encodes a photo in the browser before it is sent anywhere:
 * 1600px is plenty for receipt text and keeps uploads around 200-400 kB.
 */
export async function prepareImage(file: Blob, maxEdge = 1600): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPEG, PNG or WebP).');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('That image is over 15 MB. Try a smaller photo.');
  const img = await decode(file);
  const full = render(img, maxEdge, 0.82);
  const thumb = render(img, 240, 0.7);
  if ('close' in img) img.close();
  const base64 = full.dataUrl.slice(full.dataUrl.indexOf(',') + 1);
  return {
    dataUrl: full.dataUrl, base64, mimeType: 'image/jpeg', thumbnail: thumb.dataUrl,
    width: full.width, height: full.height, bytes: Math.round((base64.length * 3) / 4),
  };
}
