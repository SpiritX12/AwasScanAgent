// Code decides the verdict. Tool signals set the floor; the model can only raise it, and only with cited findings.
// There is deliberately no "safe" verdict: the best outcome is "no red flags found".

import type { Signal } from './evidence.ts';

export const RISK_LEVELS = ['no_red_flags_found', 'suspicious', 'high_risk'] as const;
export type Risk = (typeof RISK_LEVELS)[number];
export type Language = 'en' | 'ms';

/** Evidence id of the user's own message, so the model can cite what the message itself says. */
export const MESSAGE_EVIDENCE_ID = 'MSG';

export interface EvidenceEntry {
  id: string;
  tool: string;
  signals: Signal[];
}

export interface ModelFinding {
  text: string;
  cites: string[];
}

export interface ModelAnswer {
  risk: Risk;
  language: Language;
  findings: ModelFinding[];
  advice: string;
}

export interface Verdict {
  risk: Risk;
  language: Language;
  findings: ModelFinding[]; // only findings whose citations all point at real evidence
  signals: Signal[];
  advice: string;
}

const rank = (risk: Risk) => RISK_LEVELS.indexOf(risk);
const maxRisk = (a: Risk, b: Risk): Risk => (rank(a) >= rank(b) ? a : b);

export function riskFromSignals(signals: Signal[]): Risk {
  if (signals.some((s) => s.severity === 'high')) return 'high_risk';
  if (signals.some((s) => s.severity === 'medium')) return 'suspicious';
  return 'no_red_flags_found';
}

export function decideVerdict(evidence: EvidenceEntry[], answer: ModelAnswer | null): Verdict {
  const signals = evidence.flatMap((e) => e.signals);
  const codeRisk = riskFromSignals(signals);
  const knownIds = new Set([MESSAGE_EVIDENCE_ID, ...evidence.map((e) => e.id)]);

  const findings = (answer?.findings ?? []).filter(
    (f) => f.text.trim() && f.cites.length > 0 && f.cites.every((id) => knownIds.has(id)),
  );

  // The model may raise the risk only if it backed that up. Findings that cite only the message itself
  // (tactics like urgency or impersonation) can raise to "suspicious", not to "high_risk".
  let modelRisk: Risk = 'no_red_flags_found';
  if (answer && findings.length > 0) {
    const toolBacked = findings.some((f) => f.cites.some((id) => id !== MESSAGE_EVIDENCE_ID));
    modelRisk = toolBacked ? answer.risk : (rank(answer.risk) > rank('suspicious') ? 'suspicious' : answer.risk);
  }

  return {
    risk: maxRisk(codeRisk, modelRisk),
    language: answer?.language === 'ms' ? 'ms' : 'en',
    findings,
    signals,
    advice: answer?.advice?.trim() ?? '',
  };
}

const HEADLINES: Record<Language, Record<Risk, string>> = {
  en: {
    high_risk: '🔴 High risk: this looks like a scam.',
    suspicious: '🟠 Suspicious: be careful.',
    no_red_flags_found: '⚪ No red flags found. That does not prove it is safe.',
  },
  ms: {
    high_risk: '🔴 Risiko tinggi: ini kelihatan seperti penipuan.',
    suspicious: '🟠 Mencurigakan: berhati-hati.',
    no_red_flags_found: '⚪ Tiada tanda bahaya ditemui. Ini tidak bermakna ia selamat.',
  },
};

const LABELS: Record<Language, { found: string; evidence: string; hotline: string }> = {
  en: { found: 'What I found:', evidence: 'Checks that flagged it:', hotline: 'Lost money or shared bank details? Call NSRC at 997 now.' },
  ms: { found: 'Apa yang saya jumpa:', evidence: 'Semakan yang menandakannya:', hotline: 'Sudah hilang wang atau beri butiran bank? Hubungi NSRC di 997 segera.' },
};

export function formatReply(verdict: Verdict): string {
  const { language } = verdict;
  const lines = [HEADLINES[language][verdict.risk]];
  if (verdict.findings.length > 0) {
    lines.push('', LABELS[language].found, ...verdict.findings.map((f) => `• ${f.text}`));
  }
  const flagged = verdict.signals.filter((s) => s.severity !== 'info');
  if (flagged.length > 0) {
    lines.push('', LABELS[language].evidence, ...flagged.map((s) => `• ${s.detail}`));
  }
  if (verdict.advice) lines.push('', verdict.advice);
  lines.push('', LABELS[language].hotline);
  return lines.join('\n');
}
