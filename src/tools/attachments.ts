// Code check of forwarded files by name and type. The file is never downloaded or opened.
// Used for files forwarded to the bot, and (via the check_file_name tool) for file names seen in a screenshot.

import { signal, type Signal, type ToolResult } from '../evidence.ts';

export interface AttachedFile {
  name: string;
  mimeType: string;
}

const ANDROID_PACKAGE_MIME = 'application/vnd.android.package-archive';
const APK_NAME = /\.(apk|xapk|apks|apkm)$/i;
const ARCHIVE_NAME = /\.(zip|rar|7z)$/i;
const ARCHIVE_MIMES = new Set(['application/zip', 'application/x-zip-compressed', 'application/vnd.rar', 'application/x-rar-compressed', 'application/x-7z-compressed']);
const DOUBLE_EXTENSION = /\.(pdf|jpe?g|png|docx?|xlsx?|mp4)\.(apk|xapk|apks|apkm|zip|rar|7z|exe|scr)$/i;
// Archives named to pass for a document: "PDF_0A4Z3D_2026...zip", "DOC_9445_...zip", "SOA_...zip", "invoice.pdf.zip".
const DOCUMENT_STYLE_ARCHIVE = /^(pdf|doc|docx|soa|invoice|inv|statement|penyata|resit|receipt)[_\-\s]/i;

export function isAndroidPackage(file: AttachedFile): boolean {
  return APK_NAME.test(file.name) || file.mimeType === ANDROID_PACKAGE_MIME;
}

export function isArchive(file: AttachedFile): boolean {
  return ARCHIVE_NAME.test(file.name) || ARCHIVE_MIMES.has(file.mimeType);
}

/** Files the bot checks: Android apps and archives. Other documents are not investigated. */
export function isCheckableFile(file: AttachedFile): boolean {
  return isAndroidPackage(file) || isArchive(file);
}

export function checkAttachments(files: AttachedFile[]): Signal[] {
  const signals: Signal[] = [];
  for (const file of files) {
    if (isAndroidPackage(file)) {
      signals.push(signal(
        'apk_file_attached',
        'high',
        `The file "${file.name}" is an Android app (APK). Installing it can let scammers read your SMS and bank codes.`,
        `Fail "${file.name}" ialah aplikasi Android (APK). Memasangnya boleh membenarkan penipu membaca SMS dan kod bank anda.`,
      ));
    } else if (isArchive(file) && (DOCUMENT_STYLE_ARCHIVE.test(file.name) || DOUBLE_EXTENSION.test(file.name))) {
      signals.push(signal(
        'archive_disguised_document',
        'high',
        `The file "${file.name}" is a ZIP archive named to look like a document. These often hide a program that infects computers.`,
        `Fail "${file.name}" ialah arkib ZIP yang dinamakan seperti dokumen. Ia sering menyembunyikan program yang menjangkiti komputer.`,
      ));
    } else if (isArchive(file)) {
      signals.push(signal(
        'archive_attached',
        'info',
        `The file "${file.name}" is a compressed archive; its contents cannot be seen before opening.`,
        `Fail "${file.name}" ialah arkib termampat; kandungannya tidak dapat dilihat sebelum dibuka.`,
      ));
    }
    if (DOUBLE_EXTENSION.test(file.name)) {
      signals.push(signal(
        'file_disguised_name',
        'high',
        'The file is named to look like a document or photo, but it is not one.',
        'Fail ini dinamakan supaya kelihatan seperti dokumen atau gambar, tetapi sebenarnya bukan.',
      ));
    }
  }
  return signals;
}

/** check_file_name tool: the same checks for a file name the model read in a screenshot. */
export function checkFileName(name: string): ToolResult {
  const signals = checkAttachments([{ name: name.trim(), mimeType: 'unknown' }]);
  return { ok: true, signals, data: { file_name: name.trim(), is_android_app: APK_NAME.test(name.trim()), is_archive: ARCHIVE_NAME.test(name.trim()) } };
}
