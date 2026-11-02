# AwasScan Agent: project notes for Claude

Hackathon entry (Meta Global AI Developer Hackathon, Indie track). A Telegram bot whose agent (Meta's Muse models)
investigates suspicious Malaysian messages, screenshots, payment QRs and voice notes with real tools and replies
with an evidence-backed verdict. **Read `PLAN.md` first**: scope, day-by-day plan, rules, architecture.

## Hard rules for this repo

- **Public repo, new work only.** Write everything from scratch during the event (27 Oct to 4 Nov 2026). Never copy
  files or code from `../QRScannerSafety` (the private AwasScan app). Never make that repo public.
- **Deadline:** 4 Nov 2026, 9:00 PM ET = 5 Nov 9:00 AM Malaysia time. Our target: 4 Nov 9:00 PM MYT.
- **Meta Model API, Standard mode only** (`muse-spark-1.3`, not `-contributor`): user content must not train models.
  Base URL `https://api.meta.ai/v1`, key in env `MODEL_API_KEY`. Audio goes to `muse-voice-transcribe-1.0`, not Spark.
- **Verdicts never say "safe".** Code decides the verdict from tool evidence; the model may raise risk, never lower it.
  Every model finding must cite a tool result, or code drops it.
- **Link following only through the SSRF guard** (private/reserved IPs blocked inside the DNS lookup, ports 80/443,
  max 5 redirects, hard deadlines, never read bodies).
- **Privacy:** never log message content, images, transcripts, account numbers or URLs with query strings.
  Test data is synthetic; no real people's names or account numbers.
- **Secrets** (`MODEL_API_KEY`, `TELEGRAM_BOT_TOKEN`, Baseten key) only in `.env` (git-ignored) and the host
  dashboard; every variable documented in `.env.example`. The owner creates and pastes keys themselves.
- Run the secret scan before every push: the repo is public, so a leaked key is exposed immediately.
- **Commits:** no "Co-Authored-By: Claude" or any AI attribution.
- **Spend:** credits need a card on file; keep usage well under $150 (cheap calls in tests are mocked; live calls only
  in a small smoke script).

## Commands

Node 24 runs the `.ts` files directly (type stripping): imports use `.ts` extensions, no enums or other
non-erasable TypeScript syntax.

```bash
npm test                                   # vitest, mocked: no network, no API spend
npm run typecheck                          # tsc --noEmit
npm run smoke                              # one LIVE call (AGENT_PROVIDER=baseten for Muse Spark Open)
npm run bot:poll                           # run the Telegram bot locally (stop it before Render is live)
npm start                                  # webhook server (Render); render.yaml is the Blueprint
python C:/Users/anwar/.claude/skills/build-discipline/scripts/slop_scan.py .
bash C:/Users/anwar/.claude/skills/security/scripts/scan-secrets.sh . --check-remote   # before every push
```

## Status

- 2026-10-28: plan written (`PLAN.md`).
- 2026-11-02: plan compressed to 2.5 days (SAM fallback cut, voice notes only if time, ~20 test cases).
  Built: agent loop, tools (decode_qr, parse_duitnow, inspect_link + SSRF guard, official_contact), code-decided
  verdict, BM/EN reply. Live smoke works on Muse Spark 1.3 and on Baseten Muse Spark Open. Modal credits not
  granted; not used. Deadline is 5 Nov 10:00 AM MYT (EST after US DST ended), our target 4 Nov 9 PM MYT.
  Telegram bot (@AwasScanAgentBot) works end to end in polling mode, tested from the owner's phone; webhook
  server + render.yaml ready. Deployed on Render (https://awasscan-agent.onrender.com), kept warm by a
  cron-job.org ping to /healthz every 10 min.
  Eval: 33 synthetic cases; both models 25/25 scams caught (22 high risk), 1/8 false alarms (friend's photo ZIP
  rated suspicious, kept as an honest miss). Code checks of every message (text tactics + forwarded APK/ZIP files
  by name/type, never downloaded) are evidence MSG; screenshots go through check_text/check_file_name tools; "high
  risk" needs cited evidence with a warning. Link check also spots APKs from response headers.
  Next: README polish, 3-minute video, X post, submit (target 4 Nov 9 PM MYT). Voice notes only if time.
