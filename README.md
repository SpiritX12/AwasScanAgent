# AwasScan Agent

A Telegram bot that investigates suspicious Malaysian messages, screenshots, payment QRs and voice notes with real
tools (QR decoding, link checks, transcription) and replies with an evidence-backed verdict. Built on Meta's Muse
models for the Meta Global AI Developer Hackathon (Indie track).

Built during the hackathon, 27 Oct to 4 Nov 2026. Work in progress; see [PLAN.md](PLAN.md).

## Run it

Needs Node 24 (runs TypeScript directly, no build step).

```bash
npm install
cp .env.example .env   # then fill in the keys
npm test               # unit tests, no network or API calls
npm run smoke          # one live investigation (costs a few cents)
```

`AGENT_PROVIDER=baseten npm run smoke` runs the same agent on Muse Spark Open via Baseten.

## How an investigation works

`src/agent.ts` sends the message (and any images) to the model with four tools from `src/tools/`:
`decode_qr`, `parse_duitnow`, `inspect_link` (behind an SSRF guard) and `official_contact`.
Each tool result becomes numbered evidence (E1, E2...). The model's final findings must cite that evidence;
`src/verdict.ts` drops uncited findings and decides the verdict in code. The model can raise the risk, never
lower it, and there is no "safe" verdict.
