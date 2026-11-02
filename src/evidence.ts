// Shared shapes for what tools report. Every tool returns signals; code (not the model) turns them into a verdict.

export type Severity = 'high' | 'medium' | 'info';

export interface Signal {
  code: string; // stable machine name, e.g. "qr_crc_mismatch"
  severity: Severity;
  detail: string; // short English explanation shown to the user as evidence
}

export interface ToolResult {
  ok: boolean;
  signals: Signal[];
  data: Record<string, unknown>; // facts the model may read and cite
}

export function signal(code: string, severity: Severity, detail: string): Signal {
  return { code, severity, detail };
}
