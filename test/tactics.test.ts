import { describe, expect, it } from 'vitest';
import { checkTactics } from '../src/tools/tactics.ts';

const codes = (text: string) => checkTactics(text).signals.map((s) => s.code);

describe('checkTactics', () => {
  it.each([
    ['Please reply with the 6-digit TAC we just sent to your phone.', 'asks_for_secret_code'],
    ['Sila berikan kod OTP yang anda terima.', 'asks_for_secret_code'],
    ['Verify your PIN at the link today.', 'asks_for_secret_code'],
    ['Pindahkan semua simpanan ke akaun selamat untuk siasatan.', 'safe_account_transfer'],
    ['Waran tangkap akan dikeluarkan hari ini.', 'arrest_threat'],
    ['Kami boleh dapatkan semula wang RM12,000 yang anda hilang.', 'fund_recovery_offer'],
    ['Guaranteed 30% return every week.', 'guaranteed_returns'],
    ['First task need deposit RM100 to activate account.', 'upfront_fee'],
    ['Just like TikTok videos and earn RM150-RM300 per day.', 'easy_money'],
    ['Jangan beritahu sesiapa tentang perkara ini.', 'secrecy'],
    ['Tuntut di laman ini dengan memasukkan butiran perbankan anda.', 'asks_for_bank_details'],
    ['Tahniah! Anda memenangi iPhone. Bayar kos penghantaran RM9.90 sahaja.', 'prize_fee'],
    ['Register as member and download our app here to get 50% off.', 'install_app_request'],
    ['RM0: You requested to purchase vouchers. Send CODA 656001 to 20000 to complete.', 'sms_code_confirmation'],
    ['If cannot open using phone, pls use computer to open. Tq.', 'open_on_computer'],
    ['Tolong buka komputer dan semak ya', 'open_on_computer'],
    ['SOA sudah keluar. Pls help forward to ur company PIC or finance side for checking ya.', 'forward_to_finance'],
    ['Klik sini instal aplikasi jemputan', 'install_app_request'],
  ])('finds the tactic in: %s', (text, expected) => {
    expect(codes(text)).toContain(expected);
  });

  it('does not flag a genuine OTP message that warns not to share it', () => {
    expect(codes('Your Shopee verification code is 482913. Never share this code with anyone, including Shopee staff.')).toEqual([]);
  });

  it('does not flag an app download that points to the Play Store', () => {
    expect(codes('Download the official MySejahtera app from Google Play.')).toEqual([]);
  });

  it('does not flag an ordinary message', () => {
    expect(codes('Weh, jadi tak makan malam Jumaat ni? Aku dah book meja pukul 8.')).toEqual([]);
  });
});
