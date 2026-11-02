import QRCode from 'qrcode';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { decodeQr } from '../src/tools/qr.ts';
import { buildPayload } from './duitnow.test.ts';

describe('decodeQr', () => {
  it('reads a payment QR placed inside a larger image', async () => {
    const payload = buildPayload();
    const qr = await QRCode.toBuffer(payload, { width: 300 });
    const poster = await sharp({ create: { width: 900, height: 700, channels: 3, background: '#f4e9d0' } })
      .composite([{ input: qr, left: 420, top: 250 }]).png().toBuffer();

    const result = await decodeQr(poster);
    expect(result.data).toEqual({ kind: 'payment_qr', content: payload });
  });

  it('reports when there is no QR code', async () => {
    const blank = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#ffffff' } }).png().toBuffer();
    expect((await decodeQr(blank)).ok).toBe(false);
  });

  it('reports an unreadable image instead of throwing', async () => {
    expect((await decodeQr(Buffer.from('not an image'))).data).toEqual({ error: 'image could not be read' });
  });
});
