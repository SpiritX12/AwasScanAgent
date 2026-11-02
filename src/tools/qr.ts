// decode_qr: finds and reads a QR code in an image (screenshot or photo).

import jsqrModule from 'jsqr';
import sharp from 'sharp';
import type { ToolResult } from '../evidence.ts';

// jsqr is CommonJS: at runtime the default import is the function, but its types describe an ES default export.
const jsQR = jsqrModule as unknown as typeof jsqrModule.default;

const MAX_SIDE_PX = 1600; // big enough for posters, small enough to decode fast
const MIN_SIDE_PX = 600; // upscale small screenshots so tiny QRs still decode

async function rgbaAtWidth(image: Buffer, width: number) {
  const { data, info } = await sharp(image).rotate().resize({ width, withoutEnlargement: false }).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

export async function decodeQr(image: Buffer): Promise<ToolResult> {
  let metaWidth: number;
  try {
    metaWidth = (await sharp(image).metadata()).width ?? 0;
  } catch {
    return { ok: false, signals: [], data: { error: 'image could not be read' } };
  }
  const baseWidth = Math.min(Math.max(metaWidth, MIN_SIDE_PX), MAX_SIDE_PX);

  // Try the normal size first, then a larger and a smaller copy: jsQR is sensitive to module size.
  for (const width of [baseWidth, Math.min(baseWidth * 2, MAX_SIDE_PX * 2), Math.round(baseWidth / 2)]) {
    const { data, width: w, height: h } = await rgbaAtWidth(image, width);
    const found = jsQR(data, w, h, { inversionAttempts: 'attemptBoth' });
    if (found?.data) {
      const text = found.data;
      const kind = text.startsWith('000201') ? 'payment_qr' : /^https?:\/\//i.test(text) ? 'link' : 'text';
      return { ok: true, signals: [], data: { kind, content: text } };
    }
  }
  return { ok: false, signals: [], data: { error: 'no QR code found in the image' } };
}
