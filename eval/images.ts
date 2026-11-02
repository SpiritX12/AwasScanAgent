// Synthetic QR posters for the eval. All names and account numbers are made up.

import QRCode from 'qrcode';
import sharp from 'sharp';
import { crc16 } from '../src/tools/duitnow.ts';

const tlv = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, '0')}${value}`;

function paymentPayload(merchantName: string, account: string): string {
  const body = [
    tlv('00', '01'), tlv('01', '11'),
    tlv('26', tlv('00', 'TEST.DUITNOW.GUI') + tlv('01', account)),
    tlv('52', '5411'), tlv('53', '458'), tlv('58', 'MY'),
    tlv('59', merchantName), tlv('60', 'KUALA LUMPUR'),
  ].join('') + '6304';
  return body + crc16(body);
}

async function poster(qrContent: string, heading: string, subheading: string): Promise<Buffer> {
  const qr = await QRCode.toBuffer(qrContent, { width: 360 });
  const label = Buffer.from(`<svg width="600" height="120"><text x="300" y="50" font-size="32" text-anchor="middle" font-family="sans-serif">${heading}</text><text x="300" y="95" font-size="22" text-anchor="middle" font-family="sans-serif">${subheading}</text></svg>`);
  return sharp({ create: { width: 600, height: 560, channels: 3, background: '#fff6e0' } })
    .composite([{ input: label, top: 10, left: 0 }, { input: qr, top: 150, left: 120 }])
    .png().toBuffer();
}

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A plain chat screenshot: one incoming text bubble and one file bubble. No real contact details. */
async function chatScreenshot(lines: string[], fileName: string, fileInfo: string): Promise<Buffer> {
  const textRows = lines.map((line, i) => `<text x="40" y="${200 + i * 34}" font-size="24" font-family="sans-serif">${escapeXml(line)}</text>`).join('');
  const fileTop = 200 + lines.length * 34 + 40;
  const svg = `<svg width="600" height="${fileTop + 160}" xmlns="http://www.w3.org/2000/svg">
    <rect width="600" height="${fileTop + 160}" fill="#efe7dd"/>
    <rect width="600" height="100" fill="#075e54"/>
    <text x="30" y="60" font-size="26" fill="#ffffff" font-family="sans-serif">Nombor tidak dikenali</text>
    <rect x="20" y="150" width="540" height="${lines.length * 34 + 30}" rx="12" fill="#ffffff"/>
    ${textRows}
    <rect x="20" y="${fileTop}" width="540" height="110" rx="12" fill="#ffffff"/>
    <text x="40" y="${fileTop + 45}" font-size="24" font-family="sans-serif">${escapeXml(fileName)}</text>
    <text x="40" y="${fileTop + 85}" font-size="20" fill="#667781" font-family="sans-serif">${escapeXml(fileInfo)}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export const SYNTHETIC_IMAGES: Record<string, () => Promise<Buffer>> = {
  apk_chat_screenshot: () => chatScreenshot(
    ['Salam sejahtera,', 'Maaf hantar jemputan guna WhatsApp.', 'Tengok tarikh & masa, klik sini instal'],
    'JEMPUTAN MAJLIS KAHWIN.apk', '4.8 MB • APK',
  ),
  zip_chat_screenshot: () => chatScreenshot(
    ['SOA sudah keluar. Pls help forward to ur', 'company PIC or finance side for checking ya.', 'If cannot open using phone, pls use computer.'],
    'PDF_7Q2X9K_20261101093015.ZIP', '284 KB • zip',
  ),
  // Payee account swapped after the checksum was computed: the CRC no longer matches.
  tampered_qr: () => poster(
    paymentPayload('KEDAI RUNCIT CONTOH', '0000000000001').replace('0000000000001', '0000000000999'),
    'KEDAI RUNCIT CONTOH', 'Scan to pay - DuitNow',
  ),
  // Valid QR, but it pays a person while the poster names a restaurant (sticker-over-QR scam).
  personal_qr: () => poster(paymentPayload('AHMAD BIN CONTOH', '0000000000777'), 'RESTORAN SELERA CONTOH', 'Scan to pay - DuitNow'),
  // A QR that is just a link to a bank lookalike.
  link_qr: () => poster('https://maybank2u-cashback-rm50.com/claim', 'MAYBANK CASHBACK RM50', 'Scan now, limited time'),
  // Legitimate: valid checksum, payee name matches the shop on the poster.
  shop_qr: () => poster(paymentPayload('KEDAI RUNCIT CONTOH', '0000000000001'), 'KEDAI RUNCIT CONTOH', 'Scan to pay - DuitNow'),
};
