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

(To be filled in on day 1 when the project is scaffolded.)

```bash
python C:/Users/anwar/.claude/skills/build-discipline/scripts/slop_scan.py .
bash C:/Users/anwar/.claude/skills/security/scripts/scan-secrets.sh . --check-remote   # before every push
```

## Status

- 2026-10-28: plan written (`PLAN.md`). Nothing built yet. Next: day 1 of the plan.
