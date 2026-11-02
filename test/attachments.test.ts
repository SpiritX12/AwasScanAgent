import { describe, expect, it } from 'vitest';
import { checkAttachments } from '../src/tools/attachments.ts';

const codes = (name: string, mimeType = 'application/octet-stream') => checkAttachments([{ name, mimeType }]).map((s) => s.code);

describe('checkAttachments', () => {
  it('flags an APK by its name', () => {
    expect(codes('Surat Undangan Perkahwinan Digital.apk')).toEqual(['apk_file_attached']);
  });
  it('flags an APK by its Android file type even with a harmless-looking name', () => {
    expect(codes('jemputan', 'application/vnd.android.package-archive')).toEqual(['apk_file_attached']);
  });
  it('flags an app disguised as a document', () => {
    expect(codes('kad_jemputan.pdf.apk')).toEqual(['apk_file_attached', 'apk_disguised_name']);
  });
  it('ignores ordinary documents', () => {
    expect(codes('invoice.pdf', 'application/pdf')).toEqual([]);
  });
});
