// Entry point. Webhook mode (default, for Render): an HTTP server with POST /telegram for Telegram and
// GET /healthz for keep-warm pings; registers its own webhook when it knows its public URL.
// Polling mode (`--poll`, for local testing): no server, the bot pulls updates itself.

import { createHash } from 'node:crypto';
import http from 'node:http';
import { webhookCallback } from 'grammy';
import { createBot } from './bot.ts';
import { chooseModel } from './model.ts';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

const model = chooseModel();
const bot = createBot(requireEnv('TELEGRAM_BOT_TOKEN'), model);

if (process.argv.includes('--poll')) {
  await bot.api.deleteWebhook();
  console.log(`polling as @${(await bot.api.getMe()).username} with ${model.provider}/${model.model}`);
  await bot.start();
} else {
  // Telegram only accepts [A-Za-z0-9_-] in the secret token, so send a hex hash of whatever was generated.
  const secret = createHash('sha256').update(requireEnv('TELEGRAM_WEBHOOK_SECRET')).digest('hex');
  // onTimeout "return": if a handler ever runs long, answer Telegram anyway instead of letting it retry.
  const handleUpdate = webhookCallback(bot, 'http', { secretToken: secret, onTimeout: 'return' });
  const port = Number(process.env.PORT ?? 3000);

  http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') return void res.writeHead(200).end('ok');
    if (req.method === 'POST' && req.url === '/telegram') return void handleUpdate(req, res);
    res.writeHead(404).end();
  }).listen(port, () => console.log(`listening on ${port} with ${model.provider}/${model.model}`));

  // Render sets RENDER_EXTERNAL_URL; PUBLIC_URL covers other hosts.
  const publicUrl = process.env.RENDER_EXTERNAL_URL ?? process.env.PUBLIC_URL;
  if (publicUrl) {
    await bot.api.setWebhook(`${publicUrl}/telegram`, { secret_token: secret, allowed_updates: ['message'] });
    console.log('webhook registered');
  }
}
