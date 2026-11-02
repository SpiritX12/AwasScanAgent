# Eval results

33 synthetic cases (25 scam, 8 legitimate), run 2026-11-02.
A scam counts as caught when the verdict is "suspicious" or "high risk". A false alarm is a legitimate message flagged either way.

| Model | Scams caught | Of those, high risk | False alarms | Errors | Median time |
|---|---|---|---|---|---|
| Muse Spark 1.3 (Meta API) | 25/25 | 22/25 | 1/8 | 0 | 7.9s |
| Muse Spark Open (Baseten) | 25/25 | 22/25 | 1/8 | 0 | 5.0s |

## Per case

| Case | Expected | Muse Spark 1.3 (Meta API) | Muse Spark Open (Baseten) |
|---|---|---|---|
| bank-frozen-sms (bank impersonation, link in SMS) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact |
| bank-tac-request (bank impersonation, asks for TAC) | scam | high_risk · official_contact | high_risk · official_contact, check_text |
| parcel-fee-link (fake courier fee) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact, check_text |
| parcel-apk (APK disguised as tracking) | scam | high_risk · check_text, check_file_name, inspect_link, official_contact | high_risk · inspect_link, check_text, check_file_name, official_contact |
| wedding-apk (APK wedding invitation) | scam | high_risk · inspect_link, check_file_name | high_risk · check_text, check_file_name, inspect_link |
| police-macau (police / court threat) | scam | high_risk · official_contact | high_risk · check_text, official_contact |
| lhdn-refund (fake tax refund) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact, check_text |
| job-task (task / job scam) | scam | high_risk | high_risk · check_text |
| investment-group (investment scam) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact |
| shopee-lookalike (fake e-commerce prize) | scam | high_risk · inspect_link, official_contact | high_risk · check_text, inspect_link, official_contact |
| tng-lookalike (e-wallet impersonation) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact |
| fake-nsrc-recovery (fake fund recovery (NSRC impersonation)) | scam | high_risk · official_contact | high_risk · check_text, official_contact |
| userinfo-trick (link hides real host after @) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact, check_text |
| qr-tampered (edited DuitNow QR (checksum broken)) | scam | high_risk · decode_qr, parse_duitnow | high_risk · decode_qr, parse_duitnow |
| qr-personal-name (QR sticker pays a person, not the shop) | scam | suspicious · decode_qr, parse_duitnow | suspicious · decode_qr, parse_duitnow |
| qr-lookalike-link (QR leads to lookalike bank site) | scam | high_risk · decode_qr, inspect_link, official_contact | high_risk · decode_qr, inspect_link, official_contact |
| wedding-apk-file (APK file forwarded as a wedding card) | scam | high_risk · check_file_name, check_text | high_risk · check_text, check_file_name |
| disguised-apk-file (APK disguised as a PDF) | scam | high_risk · check_file_name, official_contact, check_text | high_risk · check_file_name, check_text, official_contact |
| cleaning-app-lure (service ad pushes app install outside the Play Store) | scam | suspicious · inspect_link | suspicious · inspect_link, check_text |
| pos-spelled-domain (spelled-out official domain on another TLD) | scam | high_risk · inspect_link, official_contact | high_risk · inspect_link, official_contact |
| sms-code-charge (SMS a code to approve a charge) | scam | high_risk · official_contact | high_risk · official_contact |
| soa-zip-file (ZIP named like a PDF statement, open on computer) | scam | high_risk · check_file_name | high_risk · check_file_name, check_text |
| statement-zip-file (random-named ZIP, forward to finance) | scam | suspicious · check_text, check_file_name | suspicious · check_text, check_file_name |
| apk-screenshot (screenshot of an APK wedding card chat) | scam | high_risk · check_text, check_file_name | high_risk · check_text, check_file_name |
| zip-screenshot (screenshot of a ZIP statement chat) | scam | high_risk · check_text, check_file_name | high_risk · check_text, check_file_name |
| legit-bank-alert (card transaction alert, no link) | legit | no_red_flags_found · official_contact | no_red_flags_found · check_text, official_contact |
| legit-pos-official (delivery update pointing to official site) | legit | no_red_flags_found · inspect_link, official_contact | no_red_flags_found · inspect_link, official_contact |
| legit-friend (ordinary personal message) | legit | no_red_flags_found | no_red_flags_found |
| legit-lhdn-reminder (official reminder, official domain) | legit | no_red_flags_found · inspect_link, official_contact | no_red_flags_found · inspect_link, official_contact |
| legit-otp (OTP with do-not-share warning) | legit | no_red_flags_found | no_red_flags_found |
| legit-shop-qr (normal shop QR, name matches) | legit | no_red_flags_found · decode_qr, parse_duitnow | no_red_flags_found · decode_qr, parse_duitnow |
| legit-play-store (official app from Google Play) | legit | no_red_flags_found | no_red_flags_found |
| legit-photos-zip (friend shares a ZIP of photos) | legit | suspicious · check_file_name | suspicious · check_file_name |
