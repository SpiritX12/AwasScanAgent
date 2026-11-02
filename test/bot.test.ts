import { describe, expect, it } from 'vitest';
import { messageText } from '../src/bot.ts';
import { ChatLimiter } from '../src/limiter.ts';

describe('messageText', () => {
  it('adds links hidden behind link text', () => {
    const text = messageText({
      text: 'Click here to claim',
      entities: [{ type: 'text_link', offset: 0, length: 10, url: 'https://claim-prize.example/' }],
    });
    expect(text).toContain('https://claim-prize.example/');
  });

  it('reads a photo caption', () => {
    expect(messageText({ caption: 'Scan to pay' })).toBe('Scan to pay');
  });
});

describe('ChatLimiter', () => {
  it('allows one investigation at a time per chat', () => {
    const limiter = new ChatLimiter();
    expect(limiter.tryStart(1)).toBe('ok');
    expect(limiter.tryStart(1)).toBe('busy');
    expect(limiter.tryStart(2)).toBe('ok');
    limiter.finish(1);
    expect(limiter.tryStart(1)).toBe('ok');
  });

  it('enforces the daily cap and resets the next day', () => {
    let day = '2026-11-02';
    const limiter = new ChatLimiter(2, () => day);
    for (let i = 0; i < 2; i++) {
      expect(limiter.tryStart(1)).toBe('ok');
      limiter.finish(1);
    }
    expect(limiter.tryStart(1)).toBe('daily_limit');
    day = '2026-11-03';
    expect(limiter.tryStart(1)).toBe('ok');
  });
});
