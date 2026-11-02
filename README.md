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
`npm run eval` runs the synthetic test set ([eval/cases.json](eval/cases.json)) on both models and writes
[eval/results.md](eval/results.md).

## Eval (33 synthetic cases: 25 scam, 8 legitimate)

| Model | Scams caught | Of those, high risk | False alarms | Median time |
|---|---|---|---|---|
| Muse Spark 1.3 (Meta Model API) | 25/25 | 22/25 | 1/8 | 7.9s |
| Muse Spark Open (Baseten) | 25/25 | 22/25 | 1/8 | 5.0s |

Cases are written from public scam advisories (bank and courier impersonation, APK "wedding invitations",
police threats, fake fund recovery, tampered DuitNow QR stickers, APK files forwarded as invitations or receipts,
ZIP "statements" named like PDFs, and screenshots of such chats). All names, numbers and sites are made up.
The one false alarm: a friend sharing a ZIP of photos is rated "suspicious" by both models. We left the case
labelled legitimate rather than tune it away; unexpected ZIPs from hacked contacts are a real pattern.

## How an investigation works

Code first scans the message text for known scam tactics (`src/tools/tactics.ts`: asking for a TAC/OTP,
"safe account" transfers, arrest threats, guaranteed returns...) and forwarded files for Android apps and
disguised ZIPs (`src/tools/attachments.ts`, by name and type only: the file is never downloaded). For screenshots,
the model passes the text and file names it reads to the same code checks.

`src/agent.ts` sends the message (and any images) to the model with six tools from `src/tools/`:
`decode_qr`, `parse_duitnow`, `inspect_link` (behind an SSRF guard), `official_contact`, `check_text` and
`check_file_name`.
Each tool result becomes numbered evidence (E1, E2...). The model's final findings must cite that evidence;
`src/verdict.ts` drops uncited findings and decides the verdict in code. The model can raise the risk, never
lower it, and can only reach "high risk" by citing evidence that itself carries a warning. There is no "safe" verdict.
