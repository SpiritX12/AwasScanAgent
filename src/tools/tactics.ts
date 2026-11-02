// Code check of the message text for known Malaysian scam tactics (BM and English). Runs on every message,
// so verdicts on scams without a link or QR still rest on evidence that code found, not on the model's opinion.

import { signal, type Severity, type ToolResult } from '../evidence.ts';

interface Tactic {
  code: string;
  severity: Severity;
  pattern: RegExp;
  unless?: RegExp; // a phrase that makes the match harmless, e.g. "never share this code"
  en: string;
  ms: string;
}

const TACTICS: Tactic[] = [
  {
    code: 'asks_for_secret_code',
    severity: 'high',
    pattern: /\b(reply|send|give|share|tell|key in|balas|hantar|berikan|beri|beritahu|kongsi|masukkan)\b[^.!?\n]{0,40}\b(tac|otp|pin|password|kata laluan|kod pengesahan|verification code)\b|\b(verify|sahkan)\b[^.!?\n]{0,20}\b(pin|tac|otp|password|kata laluan)\b/i,
    unless: /\b(never|do not|don't|jangan)\b[^.!?\n]{0,20}\b(share|kongsi|beri|berikan|dedahkan)\b/i,
    en: 'The message asks for a TAC, OTP, PIN or password. Banks and agencies never ask for these.',
    ms: 'Mesej meminta TAC, OTP, PIN atau kata laluan. Bank dan agensi tidak pernah meminta maklumat ini.',
  },
  {
    code: 'asks_for_bank_details',
    severity: 'high',
    pattern: /\b((me)?masukkan|(meng)?isi|(mem)?berikan|enter|provide|key in)\b[^.!?\n]{0,30}\b(butiran perbankan|maklumat bank|butiran bank|bank details|banking details|card number|nombor kad)\b/i,
    en: 'It asks you to enter your bank or card details.',
    ms: 'Ia meminta anda memasukkan butiran bank atau kad.',
  },
  {
    code: 'prize_fee',
    severity: 'medium',
    pattern: /\b(tahniah|congratulations|menang|memenangi|won|winner)\b[\s\S]{0,120}\b(bayar|pay)\b/i,
    en: 'It says you won a prize but must pay first.',
    ms: 'Ia kata anda menang hadiah tetapi perlu bayar dahulu.',
  },
  {
    code: 'safe_account_transfer',
    severity: 'high',
    pattern: /\b(akaun selamat|safe account|pindahkan semua|transfer all|semua simpanan|all (your )?savings)\b/i,
    en: 'It tells you to move your money to another account "for safety", a classic police/bank impersonation trick.',
    ms: 'Ia menyuruh anda memindahkan wang ke akaun lain "untuk keselamatan", taktik biasa penyamar polis/bank.',
  },
  {
    code: 'arrest_threat',
    severity: 'high',
    pattern: /\b(waran tangkap|arrest warrant|akan ditangkap|will be arrested|pengubahan wang haram|money laundering)\b/i,
    en: 'It threatens arrest or a money-laundering case to frighten you.',
    ms: 'Ia mengugut tangkapan atau kes pengubahan wang haram untuk menakutkan anda.',
  },
  {
    code: 'fund_recovery_offer',
    severity: 'high',
    pattern: /\b(dapatkan semula|recover|recovery)\b[^.!?\n]{0,40}\b(wang|money|dana|funds|RM)/i,
    en: 'It offers to recover money you lost, for a fee. Real agencies do not charge for this.',
    ms: 'Ia menawarkan untuk mendapatkan semula wang yang hilang dengan bayaran. Agensi sebenar tidak mengenakan bayaran.',
  },
  {
    code: 'guaranteed_returns',
    severity: 'high',
    pattern: /\b(guaranteed|dijamin|jaminan)\b[^.!?\n]{0,30}\b(returns?|pulangan|profit|untung)\b|\d+\s?%\s*(returns?|pulangan)[^.!?\n]{0,20}\b(every|setiap)\b/i,
    en: 'It promises guaranteed or very high returns, the hallmark of an investment scam.',
    ms: 'Ia menjanjikan pulangan terjamin atau sangat tinggi, ciri utama penipuan pelaburan.',
  },
  {
    code: 'upfront_fee',
    severity: 'medium',
    pattern: /\b(fi pemprosesan|processing fee|yuran pendaftaran|registration fee|deposit\s*RM|activate (your )?account)\b/i,
    en: 'It asks for a fee or deposit before you receive anything.',
    ms: 'Ia meminta bayaran atau deposit sebelum anda menerima apa-apa.',
  },
  {
    code: 'easy_money',
    severity: 'medium',
    pattern: /\b(earn|dapat|gaji)\b[^.!?\n]{0,10}RM\s?\d[\d,\s\-RM]*\b(per day|a day|sehari|setiap hari)\b/i,
    en: 'It promises easy daily pay for simple tasks.',
    ms: 'Ia menjanjikan wang harian yang mudah untuk tugasan ringkas.',
  },
  {
    code: 'secrecy',
    severity: 'medium',
    pattern: /\b(jangan beritahu sesiapa|don'?t tell anyone|do not tell anyone|keep this (a )?secret|rahsiakan)\b/i,
    en: 'It tells you to keep it secret, so nobody can warn you.',
    ms: 'Ia menyuruh anda merahsiakannya supaya tiada sesiapa dapat memberi amaran.',
  },
  {
    code: 'install_app_request',
    severity: 'medium',
    pattern: /\b(download|install|instal|muat turun|pasang|muat naik)\b[^.!?\n]{0,40}\b(app|apps|aplikasi|apk)\b/i,
    unless: /\b(play store|google play|app store|appgallery)\b/i,
    en: 'It asks you to install an app from a link instead of the Play Store or App Store.',
    ms: 'Ia meminta anda memasang aplikasi melalui pautan, bukan dari Play Store atau App Store.',
  },
  {
    code: 'sms_code_confirmation',
    severity: 'high',
    pattern: /\b(send|hantar|reply|balas)\b\s+[A-Z]{2,10}\s+\d{4,8}\s+(to|ke)\s+\d{4,6}\b/i,
    en: 'It asks you to SMS a code to a short number, which can approve a charge on your phone bill.',
    ms: 'Ia meminta anda menghantar kod melalui SMS ke nombor pendek, yang boleh meluluskan caj pada bil telefon.',
  },
  {
    code: 'open_on_computer',
    severity: 'medium',
    pattern: /\b(use|guna|gunakan|buka|open)\b[^.!?\n]{0,15}\b(computer|komputer|pc|laptop)\b/i,
    en: 'It pushes you to open the file on a computer, where hidden programs in ZIP files can run.',
    ms: 'Ia mendesak anda membuka fail di komputer, di mana program tersembunyi dalam fail ZIP boleh berjalan.',
  },
  {
    code: 'forward_to_finance',
    severity: 'medium',
    pattern: /\b(forward|hantar|majukan)\b[^.!?\n]{0,40}\b(finance|kewangan|accounts?|akaun syarikat|PIC)\b/i,
    en: 'It asks you to pass a file to your company\'s finance or accounts team, a common way to spread office malware.',
    ms: 'Ia meminta anda menghantar fail kepada bahagian kewangan syarikat, cara biasa menyebarkan perisian hasad pejabat.',
  },
  {
    code: 'pressure_deadline',
    severity: 'info',
    pattern: /\b(dalam \d+ jam|within \d+ hours?|segera|immediately|hari ini juga|today only)\b/i,
    en: 'It pressures you with a short deadline.',
    ms: 'Ia mendesak anda dengan tarikh akhir yang singkat.',
  },
];

export function checkTactics(text: string): ToolResult {
  const found = TACTICS.filter((t) => t.pattern.test(text) && !(t.unless?.test(text)));
  return {
    ok: true,
    signals: found.map((t) => signal(t.code, t.severity, t.en, t.ms)),
    data: { tactics_found: found.map((t) => t.code) },
  };
}
