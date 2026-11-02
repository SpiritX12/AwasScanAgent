// Code check of forwarded files. Only Telegram's file name and type are used: the file is never downloaded or opened.

import { signal, type Signal } from '../evidence.ts';

export interface AttachedFile {
  name: string;
  mimeType: string;
}

const ANDROID_PACKAGE_MIME = 'application/vnd.android.package-archive';
const APK_NAME = /\.(apk|xapk|apks|apkm)$/i;
const DOUBLE_EXTENSION = /\.(pdf|jpe?g|png|docx?|mp4)\.(apk|xapk|apks|apkm)$/i;

export function isAndroidPackage(file: AttachedFile): boolean {
  return APK_NAME.test(file.name) || file.mimeType === ANDROID_PACKAGE_MIME;
}

export function checkAttachments(files: AttachedFile[]): Signal[] {
  const signals: Signal[] = [];
  for (const file of files.filter(isAndroidPackage)) {
    signals.push(signal(
      'apk_file_attached',
      'high',
      `The forwarded file "${file.name}" is an Android app (APK). Installing it can let scammers read your SMS and bank codes.`,
      `Fail "${file.name}" ialah aplikasi Android (APK). Memasangnya boleh membenarkan penipu membaca SMS dan kod bank anda.`,
    ));
    if (DOUBLE_EXTENSION.test(file.name)) {
      signals.push(signal(
        'apk_disguised_name',
        'high',
        'The app is named to look like a document or photo.',
        'Aplikasi ini dinamakan supaya kelihatan seperti dokumen atau gambar.',
      ));
    }
  }
  return signals;
}
