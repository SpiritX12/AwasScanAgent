import { describe, expect, it } from 'vitest';
import { signal } from '../src/evidence.ts';
import { decideVerdict, formatReply, type EvidenceEntry, type ModelAnswer } from '../src/verdict.ts';

const highEvidence: EvidenceEntry[] = [{ id: 'E1', tool: 'inspect_link', signals: [signal('link_lookalike', 'high', 'Lookalike site.', 'Laman tiruan.')] }];
const mediumEvidence: EvidenceEntry[] = [{ id: 'E1', tool: 'parse_duitnow', signals: [signal('qr_no_merchant_name', 'medium', 'No payee name.', 'Tiada nama penerima.')] }];
const cleanEvidence: EvidenceEntry[] = [{ id: 'E1', tool: 'inspect_link', signals: [] }];
const answer = (overrides: Partial<ModelAnswer>): ModelAnswer => ({ risk: 'no_red_flags_found', language: 'en', findings: [], advice: '', ...overrides });

describe('decideVerdict', () => {
  it('never lets the model lower a risk the tools found', () => {
    const verdict = decideVerdict(highEvidence, answer({ risk: 'no_red_flags_found', findings: [{ text: 'Looks fine', cites: ['E1'] }] }));
    expect(verdict.risk).toBe('high_risk');
  });

  it('lets the model raise to high risk when it cites evidence that carries a warning', () => {
    const verdict = decideVerdict(mediumEvidence, answer({ risk: 'high_risk', findings: [{ text: 'Pays a person, not the shop', cites: ['E1'] }] }));
    expect(verdict.risk).toBe('high_risk');
  });

  it('caps at suspicious when the cited evidence found nothing wrong', () => {
    const verdict = decideVerdict(cleanEvidence, answer({ risk: 'high_risk', findings: [{ text: 'Sounds like a scam', cites: ['E1'] }] }));
    expect(verdict.risk).toBe('suspicious');
  });

  it('drops findings without citations or with made-up evidence ids', () => {
    const verdict = decideVerdict(cleanEvidence, answer({
      risk: 'high_risk',
      findings: [{ text: 'No cite', cites: [] }, { text: 'Fake cite', cites: ['E9'] }],
    }));
    expect(verdict.findings).toEqual([]);
    expect(verdict.risk).toBe('no_red_flags_found');
  });

  it('caps findings that cite only the message at suspicious', () => {
    const verdict = decideVerdict([], answer({ risk: 'high_risk', findings: [{ text: 'Urgent threat to close account', cites: ['MSG'] }] }));
    expect(verdict.risk).toBe('suspicious');
  });

  it('still decides from evidence when the model gave no usable answer', () => {
    expect(decideVerdict(highEvidence, null).risk).toBe('high_risk');
  });
});

describe('formatReply', () => {
  it('never calls anything safe, in either language', () => {
    for (const language of ['en', 'ms'] as const) {
      const text = formatReply(decideVerdict(cleanEvidence, answer({ language })));
      expect(text).toMatch(language === 'en' ? /does not prove it is safe/ : /tidak bermakna ia selamat/);
      expect(text).toContain('997');
    }
  });

  it('shows evidence in the reply language', () => {
    expect(formatReply(decideVerdict(highEvidence, answer({ language: 'ms' })))).toContain('Laman tiruan.');
    expect(formatReply(decideVerdict(highEvidence, answer({ language: 'en' })))).toContain('Lookalike site.');
  });
});
