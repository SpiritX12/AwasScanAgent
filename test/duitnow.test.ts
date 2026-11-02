import { describe, expect, it } from 'vitest';
import { crc16, parseDuitNow } from '../src/tools/duitnow.ts';

const tlv = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, '0')}${value}`;

/** Builds a synthetic EMV payment payload with a correct checksum. */
export function buildPayload(fields: { merchant?: string; currency?: string } = {}): string {
  const body = [
    tlv('00', '01'),
    tlv('01', '11'),
    tlv('26', tlv('00', 'TEST.DUITNOW.GUI') + tlv('01', '0000000000001')),
    tlv('52', '5411'),
    tlv('53', fields.currency ?? '458'),
    tlv('58', 'MY'),
    fields.merchant === undefined ? tlv('59', 'KEDAI RUNCIT CONTOH') : fields.merchant ? tlv('59', fields.merchant) : '',
    tlv('60', 'KUALA LUMPUR'),
  ].join('') + '6304';
  return body + crc16(body);
}

describe('crc16', () => {
  it('matches the CRC-16/CCITT-FALSE check value', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
});

describe('parseDuitNow', () => {
  it('reads a valid payload without raising flags', () => {
    const result = parseDuitNow(buildPayload());
    expect(result.ok).toBe(true);
    expect(result.signals).toEqual([]);
    expect(result.data.merchant_name).toBe('KEDAI RUNCIT CONTOH');
    expect(result.data.checksum_valid).toBe(true);
  });

  it('flags an edited payload whose checksum no longer matches', () => {
    const tampered = buildPayload().replace('KEDAI RUNCIT CONTOH', 'KEDAI RUNCIT CONTOX');
    const codes = parseDuitNow(tampered).signals.map((s) => s.code);
    expect(codes).toContain('qr_crc_mismatch');
  });

  it('flags a missing payee name and a foreign currency', () => {
    const codes = parseDuitNow(buildPayload({ merchant: '', currency: '840' })).signals.map((s) => s.code);
    expect(codes).toEqual(expect.arrayContaining(['qr_no_merchant_name', 'qr_foreign_currency']));
  });

  it('says a non-payment QR is not EMV', () => {
    const result = parseDuitNow('https://example.com');
    expect(result.ok).toBe(false);
    expect(result.signals[0].code).toBe('qr_not_emv');
  });
});
