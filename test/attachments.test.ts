import { describe, expect, it } from 'vitest';
import { checkAttachments, checkFileName, isCheckableFile } from '../src/tools/attachments.ts';

const codes = (name: string, mimeType = 'application/octet-stream') => checkAttachments([{ name, mimeType }]).map((s) => s.code);
const severities = (name: string) => checkAttachments([{ name, mimeType: 'application/zip' }]).map((s) => s.severity);

describe('checkAttachments', () => {
  it('flags an APK by its name', () => {
    expect(codes('Surat Undangan Perkahwinan Digital.apk')).toEqual(['apk_file_attached']);
  });
  it('flags an APK by its Android file type even with a harmless-looking name', () => {
    expect(codes('jemputan', 'application/vnd.android.package-archive')).toEqual(['apk_file_attached']);
  });
  it('flags an app disguised as a document', () => {
    expect(codes('kad_jemputan.pdf.apk')).toEqual(['apk_file_attached', 'file_disguised_name']);
  });
  it('flags a ZIP named like a PDF or document', () => {
    expect(codes('PDF_0A1B2C_20261101123456.ZIP')).toEqual(['archive_disguised_document']);
    expect(codes('DOC_1234_20261101104542.zip')).toEqual(['archive_disguised_document']);
    expect(codes('penyata.pdf.zip')).toEqual(['archive_disguised_document', 'file_disguised_name']);
  });
  it('only notes (does not flag) an ordinary ZIP', () => {
    expect(severities('gambar_hari_raya.zip')).toEqual(['info']);
  });
  it('ignores ordinary documents', () => {
    expect(codes('invoice.pdf', 'application/pdf')).toEqual([]);
    expect(isCheckableFile({ name: 'invoice.pdf', mimeType: 'application/pdf' })).toBe(false);
  });
});

describe('checkFileName (file names read from a screenshot)', () => {
  it('runs the same checks on a name the model reads', () => {
    expect(checkFileName(' JEMPUTAN MAJLIS KAHWIN.apk ').signals.map((s) => s.code)).toEqual(['apk_file_attached']);
  });
});
