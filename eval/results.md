# Eval results

28 synthetic cases (21 scam, 7 legitimate), run 2026-11-02.
A scam counts as caught when the verdict is "suspicious" or "high risk". A false alarm is a legitimate message flagged either way.

| Model | Scams caught | Of those, high risk | False alarms | Errors | Median time |
|---|---|---|---|---|---|
| Muse Spark 1.3 (Meta API) | 21/21 | 19/21 | 0/7 | 0 | 7.2s |
| Muse Spark Open (Baseten) | 21/21 | 20/21 | 0/7 | 0 | 4.1s |

## Per case

| Case | Expected | Muse Spark 1.3 (Meta API) | Muse Spark Open (Baseten) |
|---|---|---|---|
| bank-frozen-sms (bank impersonation, link in SMS) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact |
| bank-tac-request (bank impersonation, asks for TAC) | scam | high_risk · official_contact | high_risk · official_contact |
| parcel-fee-link (fake courier fee) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact |
| parcel-apk (APK disguised as tracking) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact |
| wedding-apk (APK wedding invitation) | scam | high_risk · inspect_link | high_risk · inspect_link |
| police-macau (police / court threat) | scam | high_risk · official_contact | high_risk · official_contact |
| lhdn-refund (fake tax refund) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact |
| job-task (task / job scam) | scam | high_risk | high_risk |
| investment-group (investment scam) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact |
| shopee-lookalike (fake e-commerce prize) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact |
| tng-lookalike (e-wallet impersonation) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact |
| fake-nsrc-recovery (fake fund recovery (NSRC impersonation)) | scam | high_risk · official_contact | high_risk · official_contact |
| userinfo-trick (link hides real host after @) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact |
| qr-tampered (edited DuitNow QR (checksum broken)) | scam | high_risk · decode_qr, parse_duitnow | high_risk · decode_qr, parse_duitnow |
| qr-personal-name (QR sticker pays a person, not the shop) | scam | suspicious · decode_qr, parse_duitnow | suspicious · decode_qr, parse_duitnow |
| qr-lookalike-link (QR leads to lookalike bank site) | scam | high_risk · decode_qr, inspect_link, official_contact | high_risk · decode_qr, inspect_link, official_contact |
| wedding-apk-file (APK file forwarded as a wedding card) | scam | high_risk | high_risk |
| disguised-apk-file (APK disguised as a PDF) | scam | high_risk · official_contact | high_risk · official_contact |
| cleaning-app-lure (service ad pushes app install outside the Play Store) | scam | suspicious · inspect_link | high_risk · inspect_link |
| pos-spelled-domain (spelled-out official domain on another TLD) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact |
| sms-code-charge (SMS a code to approve a charge) | scam | high_risk · official_contact | high_risk · official_contact |
| legit-bank-alert (card transaction alert, no link) | legit | no_red_flags_found · official_contact | no_red_flags_found · official_contact |
| legit-pos-official (delivery update pointing to official site) | legit | no_red_flags_found · inspect_link, official_contact | no_red_flags_found · inspect_link, official_contact |
| legit-friend (ordinary personal message) | legit | no_red_flags_found | no_red_flags_found |
| legit-lhdn-reminder (official reminder, official domain) | legit | no_red_flags_found · inspect_link, official_contact | no_red_flags_found · inspect_link, official_contact |
| legit-otp (OTP with do-not-share warning) | legit | no_red_flags_found | no_red_flags_found |
| legit-shop-qr (normal shop QR, name matches) | legit | no_red_flags_found · decode_qr, parse_duitnow | no_red_flags_found · decode_qr, parse_duitnow |
| legit-play-store (official app from Google Play) | legit | no_red_flags_found | no_red_flags_found |
