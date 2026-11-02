// Code decides the verdict. Tool signals set the floor; the model can only raise it, and only with cited findings.
// To raise all the way to "high risk", a cited piece of evidence must itself carry a warning signal.
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
  tools: string[]; // tools the agent called, in order (for the eval report)
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

  // The model may raise the risk only with cited findings. Citing evidence that found nothing wrong
  // (e.g. a list of official websites) supports at most "suspicious", never "high_risk".
  let modelRisk: Risk = 'no_red_flags_found';
  if (answer && findings.length > 0) {
    const byId = new Map(evidence.map((e) => [e.id, e]));
    const citesAWarning = findings.some((f) =>
      f.cites.some((id) => byId.get(id)?.signals.some((s) => s.severity !== 'info')));
    modelRisk = citesAWarning || rank(answer.risk) <= rank('suspicious') ? answer.risk : 'suspicious';
  }

  return {
    risk: maxRisk(codeRisk, modelRisk),
    language: answer?.language === 'ms' ? 'ms' : 'en',
    findings,
    signals,
    advice: answer?.advice?.trim() ?? '',
    tools: evidence.filter((e) => e.id !== MESSAGE_EVIDENCE_ID).map((e) => e.tool),
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
    lines.push('', LABELS[language].evidence, ...flagged.map((s) => `• ${s.detail[language]}`));
  }
  if (verdict.advice) lines.push('', verdict.advice);
  lines.push('', LABELS[language].hotline);
  return lines.join('\n');
}
