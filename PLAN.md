# AwasScan Agent: hackathon build plan

Entry for the **Meta Global AI Developer Hackathon** (Indie Developer track, theme **Build for Your World**).
Building period 27 Oct to 4 Nov 2026. **Submission deadline: Wed 4 Nov, 9:00 PM ET = Thu 5 Nov, 9:00 AM Malaysia time.**
Our own target: submitted by **Wed 4 Nov, 9:00 PM Malaysia time** (12 hours of buffer).

## The one-line pitch

Forward any suspicious WhatsApp/Telegram message, screenshot, payment QR or voice note to a Telegram bot. An agent
built on Meta's models **investigates it with real tools** (decodes the QR, follows the link, checks domain age,
transcribes the voice note) and replies in Bahasa Malaysia or English with a verdict **backed by evidence it can
show**, never just "the AI thinks so".

## Rules that shape the build (from the participant guide)

| Rule | What we do |
|---|---|
| Public repo required | New public GitHub repo for this folder only. The private AwasScan repo stays private and untouched. |
| Indie track: new work only; demo must show only what was built during the event | Everything written from scratch from 28 Oct. **No files copied from `QRScannerSafety`.** Public specs (PayNet DuitNow) and our own knowledge are fine. README states "built during the hackathon, 27 Oct to 4 Nov". |
| Banned: "Simple Image Analyzers", basic RAG, medical advice | It's an **agent with tools and verifiable evidence**, not "image in, opinion out". |
| No code/data/assets we don't own | Test set is our own synthetic messages + paraphrased public advisories. No real people's names or account numbers. |
| 3-minute demo video + public repo + live product | Telegram bot is the live product; video recorded on 4 Nov. |
| Judging: Impact 30%, Meta tooling 25%, Technical depth 20%, Demo 25% | Use 4 Meta models in ways that matter; an eval harness for depth; a demo that shows real scams being caught. |

## What it uses from Meta (25% of the score)

All on Meta Model API (`https://api.meta.ai/v1`, OpenAI-compatible, key in `MODEL_API_KEY`), Standard mode only
(users' screenshots must not be used for training).

| Model | ID | Job |
|---|---|---|
| Muse Spark 1.3 | `muse-spark-1.3` | The agent: reads screenshots/PDFs, plans which tools to call, tool loop, structured verdict |
| Muse Voice Transcribe | `muse-voice-transcribe-1.0` | Voice-note scams (fake police, "your child is in trouble"), BM/EN code-switching. File endpoint `POST /v1/asr/transcribe` |
| SAM 3.1 | `sam-3.1` | Finds QR codes inside messy photos/posters when the plain decoder fails ("QR code" prompt -> box -> crop -> decode) |
| Muse Spark Open | `meta-models/muse-spark-open-1026` (Baseten) | Same agent on the open-weight model, for the **$10k Open Weight bonus**, and an eval comparing both |

Note from Meta's docs: Muse Spark 1.3 audio input is degraded, so audio goes to Voice Transcribe, never to Spark.

## Architecture (smallest thing that works)

```
Telegram bot (grammY, webhook)  ->  investigate(input)  ->  reply in user's language
                                      |
                                      |  agent loop (Muse Spark 1.3, tool calling, max ~8 steps)
                                      |   tools:
                                      |    decode_qr(image)        jsQR; on failure -> SAM 3.1 locate + crop + retry
                                      |    parse_duitnow(payload)  EMV TLV + CRC-16 + participant table (PayNet spec v1.5)
                                      |    inspect_link(url)       lookalike brands, APK, punycode/@ tricks,
                                      |                            redirect follow behind an SSRF guard, RDAP domain age
                                      |    transcribe(audio)       Muse Voice Transcribe
                                      |    official_contact(org)   curated official domains + hotlines (NSRC 997)
                                      |
                                      v
                                 verdict = decided by CODE from tool evidence + the model's cited findings
                                 (model may raise risk, never lower it; no "safe" verdict exists)
```

"Verifiable" (ties to the Agents 102 workshop): every finding the model returns must cite a tool result ID. Code
rejects findings without a valid citation, and the reply shows the evidence ("this QR pays a personal account at
X bank, not the shop named in the message").

**Security non-negotiables (rewrite, don't copy):** the link follower must block private/reserved IPs inside the DNS
lookup, allow ports 80/443 only, cap redirects (5), hard deadlines, and never read response bodies. Never log message
content, account numbers or full URLs with query strings. Secrets only in `.env` (git-ignored) and the host dashboard.

**Stack:** Node 24 + TypeScript, `openai` SDK (pointed at Meta's base URL), `grammy` (Telegram), `jsqr`, Vitest.
Host: Render free (Docker, Singapore) with a Telegram webhook. Run a keep-warm ping during judging week.

## Day-by-day (Malaysia time)

| Day | Date | Goal (done = the check in brackets passes) |
|---|---|---|
| 1 | Wed 28 Oct | Claim credits, create public repo, skeleton: one Muse Spark call with one tool round trip (`npm test` + a live call) |
| 2 | Thu 29 Oct | `parse_duitnow` + `inspect_link` with SSRF guard, unit tests (tests fail when a rule is removed) |
| 3 | Fri 30 Oct | Screenshot -> agent loop -> verdict; `decode_qr` with SAM 3.1 fallback (works on a photo of a poster) |
| 4 | Sat 31 Oct | Voice notes via Voice Transcribe; Telegram bot end to end on Render (forward a message from the phone, get a reply) |
| 5 | Sun 1 Nov | Verifiable verdicts (citations checked by code), BM/EN replies, test set of ~40 scam + ~20 legit cases |
| 6 | Mon 2 Nov | Muse Spark Open via Baseten behind one env switch; eval script prints catch rate / false alarms for both models |
| 7 | Tue 3 Nov | Polish, README (what was built during the event, how to run, eval results), last questions in Discord |
| 8 | Wed 4 Nov | Record the 3-minute video, post on X, **submit by 9:00 PM MYT** |

If behind schedule, cut in this order: Open-weight eval (day 6) -> SAM fallback -> voice notes. Never cut the
verifiable verdict or the test set: they're the "not a simple image analyzer" proof.

## Demo video (3 min) outline

1. 0:00 The problem: real Malaysian scam types, one line each (forwarded message, fake QR, voice note).
2. 0:30 Forward a fake "Pos Laju" message: agent follows the link, finds a 3-day-old lookalike domain.
3. 1:10 Photo of a poster with a tampered DuitNow QR: SAM finds the QR, it pays a personal account, not the shop.
4. 1:50 Voice note "this is PDRM": transcribed, tactics named, official hotline given.
5. 2:20 Eval results table (Muse Spark 1.3 vs Muse Spark Open) and what was built during the event.

## Before you start (owner, today)

- [ ] Claim the $150 Meta Model API credits (form in the participant guide) by 4 Nov 9:00 PM ET. A card is required;
      use a low-balance debit/virtual card and set the Billing spend alert to about $100 (it may only notify, not block).
- [ ] Request Baseten ($100, first 2,000) and Modal ($100, first 1,000) credits today.
- [ ] Join the Discord, post in #intros. Workshop tonight: Agents 102, Thu 29 Oct 12:00 AM MYT.
- [ ] Create a Telegram bot with @BotFather (you do this; keep the token out of chat and out of git).
- [ ] Start a **new Claude session in this folder** (`AwasScanAgent`) for the build.
