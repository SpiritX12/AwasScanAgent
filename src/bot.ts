// Telegram front end. Each message is acknowledged at once, then investigated in the background so Telegram's
// webhook call returns quickly; the verdict arrives as a second message. Message content is never logged.

import { Bot, type Context } from 'grammy';
import type { Message, MessageEntity } from 'grammy/types';
import { investigate, type Investigation } from './agent.ts';
import { ChatLimiter } from './limiter.ts';
import type { ModelChoice } from './model.ts';
import { formatReply } from './verdict.ts';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const TELEGRAM_TEXT_LIMIT = 4000;

const HELP = `Hantar atau forward mesej, tangkapan skrin atau kod QR yang mencurigakan. Saya akan menyemaknya dengan alat sebenar dan beri bukti.

Send or forward a suspicious message, screenshot or payment QR. I'll check it with real tools and show the evidence.

Saya tidak pernah kata sesuatu itu "selamat". / I never say something is "safe".
Scam emergency: NSRC 997`;

const REPLIES = {
  checking: '🔎 Sedang menyemak... / Checking...',
  busy: '⏳ Masih menyemak mesej sebelum ini. / Still checking your previous message.',
  dailyLimit: 'Had harian dicapai, cuba esok. / Daily limit reached, please try tomorrow.',
  failed: 'Maaf, semakan gagal. Sila cuba lagi. / Sorry, the check failed. Please try again.',
  voiceNotYet: 'Nota suara belum disokong lagi. / Voice notes are not supported yet.',
  tooBig: 'Gambar terlalu besar (maks 10 MB). / Image too large (max 10 MB).',
};

/** Message text plus any links hidden behind link text ("click here"), which scam messages rely on. */
export function messageText(message: Pick<Message, 'text' | 'caption' | 'entities' | 'caption_entities'>): string {
  const text = message.text ?? message.caption ?? '';
  const entities: MessageEntity[] = message.entities ?? message.caption_entities ?? [];
  const hidden = entities.flatMap((e) => (e.type === 'text_link' ? [e.url] : []));
  return hidden.length > 0 ? `${text}\n\nLinks hidden in the message: ${hidden.join(' ')}` : text;
}

async function downloadFile(ctx: Context, token: string): Promise<Buffer> {
  const file = await ctx.getFile();
  if (!file.file_path) throw new Error('telegram file has no path');
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`telegram file download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The image attached to the message, if any: a photo, or a file sent "as document" that is an image. */
function attachedImageSize(message: Message): { present: boolean; bytes: number } {
  if (message.photo?.length) return { present: true, bytes: message.photo.at(-1)!.file_size ?? 0 };
  if (message.document?.mime_type?.startsWith('image/')) return { present: true, bytes: message.document.file_size ?? 0 };
  return { present: false, bytes: 0 };
}

export function createBot(token: string, model: ModelChoice, limiter = new ChatLimiter()): Bot {
  const bot = new Bot(token);

  bot.command(['start', 'help'], (ctx) => ctx.reply(HELP));
  bot.on(['message:voice', 'message:audio'], (ctx) => ctx.reply(REPLIES.voiceNotYet));

  bot.on(['message:text', 'message:photo', 'message:document'], async (ctx) => {
    const image = attachedImageSize(ctx.message);
    if (ctx.message.document && !image.present) return; // non-image files: nothing to check
    if (image.bytes > MAX_IMAGE_BYTES) return void (await ctx.reply(REPLIES.tooBig));

    const chatId = ctx.chat.id;
    const started = limiter.tryStart(chatId);
    if (started !== 'ok') return void (await ctx.reply(started === 'busy' ? REPLIES.busy : REPLIES.dailyLimit));

    await ctx.reply(REPLIES.checking);
    // Not awaited: the webhook request must finish before the (slow) investigation does.
    void (async () => {
      try {
        const input: Investigation = { text: messageText(ctx.message) };
        if (image.present) input.images = [await downloadFile(ctx, token)];
        const verdict = await investigate(input, { client: model.client, model: model.model });
        await ctx.reply(formatReply(verdict).slice(0, TELEGRAM_TEXT_LIMIT));
      } catch (error) {
        // Log only the error kind, never the message content.
        console.error('investigation failed:', error instanceof Error ? error.name : 'unknown', (error as { status?: number }).status ?? '');
        await ctx.reply(REPLIES.failed).catch((replyError) =>
          console.error('could not send failure reply:', replyError instanceof Error ? replyError.name : 'unknown'));
      } finally {
        limiter.finish(chatId);
      }
    })();
  });

  bot.catch((error) => console.error('bot error:', error.error instanceof Error ? error.error.name : 'unknown'));
  return bot;
}
