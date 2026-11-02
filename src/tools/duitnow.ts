// Parses an EMVCo merchant QR payload (the format DuitNow QR uses) and checks it for tampering.
// Spec facts used: TLV records (2-digit tag, 2-digit length, value), CRC-16/CCITT-FALSE in tag 63.

import { signal, type Signal, type ToolResult } from '../evidence.ts';

const TAG_NAMES: Record<string, string> = {
  '00': 'payload_format',
  '01': 'initiation', // 11 = static (reusable), 12 = dynamic (one payment)
  '52': 'merchant_category_code',
  '53': 'currency',
  '54': 'amount',
  '58': 'country',
  '59': 'merchant_name',
  '60': 'merchant_city',
  '62': 'additional_data',
  '63': 'crc',
};

const MYR_CURRENCY_CODE = '458';

export interface TlvRecord {
  tag: string;
  value: string;
}

/** Splits a TLV string into records. Returns null if the lengths don't add up (malformed or truncated). */
export function parseTlv(payload: string): TlvRecord[] | null {
  const records: TlvRecord[] = [];
  let i = 0;
  while (i < payload.length) {
    const tag = payload.slice(i, i + 2);
    const length = Number(payload.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(tag) || !Number.isInteger(length) || i + 4 + length > payload.length) return null;
    records.push({ tag, value: payload.slice(i + 4, i + 4 + length) });
    i += 4 + length;
  }
  return records;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as EMVCo QR requires. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(text, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function parseDuitNow(payload: string): ToolResult {
  const records = parseTlv(payload.trim());
  if (!records || records[0]?.tag !== '00') {
    return { ok: false, signals: [signal('qr_not_emv', 'info', 'This QR is not a payment (EMV) QR code.')], data: {} };
  }

  const fields: Record<string, string> = {};
  const accounts: { tag: string; subfields: Record<string, string> }[] = [];
  for (const { tag, value } of records) {
    const tagNumber = Number(tag);
    if (tagNumber >= 26 && tagNumber <= 51) {
      const sub = parseTlv(value) ?? [];
      accounts.push({ tag, subfields: Object.fromEntries(sub.map((r) => [r.tag, r.value])) });
    } else {
      fields[TAG_NAMES[tag] ?? `tag_${tag}`] = value;
    }
  }

  const signals: Signal[] = [];
  // The CRC record is always last ("6304" + 4 hex digits) and covers everything before its value.
  const trimmed = payload.trim();
  const expectedCrc = crc16(trimmed.slice(0, -4));
  if (!fields.crc || records.at(-1)?.tag !== '63') {
    signals.push(signal('qr_crc_missing', 'high', 'The QR has no checksum, so it was not made by a normal bank app.'));
  } else if (fields.crc.toUpperCase() !== expectedCrc) {
    signals.push(signal('qr_crc_mismatch', 'high', 'The QR checksum does not match its contents: it was likely edited.'));
  }
  if (accounts.length === 0) {
    signals.push(signal('qr_no_account', 'medium', 'The QR does not say which account receives the money.'));
  }
  if (fields.currency && fields.currency !== MYR_CURRENCY_CODE) {
    signals.push(signal('qr_foreign_currency', 'medium', `The QR asks for a non-ringgit currency (code ${fields.currency}).`));
  }
  if (!fields.merchant_name) {
    signals.push(signal('qr_no_merchant_name', 'medium', 'The QR does not name who gets paid.'));
  }

  return {
    ok: true,
    signals,
    data: {
      merchant_name: fields.merchant_name ?? null,
      merchant_city: fields.merchant_city ?? null,
      amount: fields.amount ?? null,
      is_reusable_qr: fields.initiation === '11',
      receiving_account_templates: accounts,
      checksum_valid: signals.every((s) => !s.code.startsWith('qr_crc')),
    },
  };
}
