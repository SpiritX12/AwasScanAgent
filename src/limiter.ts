// Per-chat limits so one chat can't run up the model bill: one investigation at a time, and a daily cap.
// In memory on purpose: a restart resets it, which is fine for a single small instance.

export const DAILY_LIMIT_PER_CHAT = 20;

type StartResult = 'ok' | 'busy' | 'daily_limit';

export class ChatLimiter {
  private chats = new Map<number, { day: string; count: number; busy: boolean }>();
  private dailyLimit: number;
  private today: () => string;

  constructor(dailyLimit = DAILY_LIMIT_PER_CHAT, today = () => new Date().toISOString().slice(0, 10)) {
    this.dailyLimit = dailyLimit;
    this.today = today;
  }

  tryStart(chatId: number): StartResult {
    const day = this.today();
    const state = this.chats.get(chatId);
    const current = state && state.day === day ? state : { day, count: 0, busy: false };
    if (current.busy) return 'busy';
    if (current.count >= this.dailyLimit) return 'daily_limit';
    this.chats.set(chatId, { day, count: current.count + 1, busy: true });
    return 'ok';
  }

  finish(chatId: number): void {
    const state = this.chats.get(chatId);
    if (state) state.busy = false;
  }
}
