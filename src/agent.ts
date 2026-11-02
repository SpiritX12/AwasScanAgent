// investigate(): the agent loop. The model plans and calls tools; every tool result is stored as numbered
// evidence (E1, E2...). When the model stops calling tools it returns JSON findings that must cite evidence ids,
// and code turns evidence + cited findings into the verdict (see verdict.ts).

import type OpenAI from 'openai';
import type { ChatCompletionContentPart, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import sharp from 'sharp';
import { TOOL_DEFINITIONS, runTool } from './tools/index.ts';
import { checkAttachments, type AttachedFile } from './tools/attachments.ts';
import { checkTactics } from './tools/tactics.ts';
import {
  MESSAGE_EVIDENCE_ID, RISK_LEVELS, decideVerdict,
  type EvidenceEntry, type ModelAnswer, type Verdict,
} from './verdict.ts';

const MAX_STEPS = 8;
const MAX_IMAGE_SIDE_PX = 1280;

export interface Investigation {
  text?: string;
  images?: Buffer[];
  files?: AttachedFile[]; // forwarded non-image files: name and type only, never the content
}

export interface AgentOptions {
  client: OpenAI;
  model: string;
  maxSteps?: number;
}

const SYSTEM_PROMPT = `You are AwasScan, a scam investigator for people in Malaysia.
The user forwards a suspicious message, screenshot or payment QR. Investigate with the tools before judging:
- Attached image with a QR code: call decode_qr. If it is a payment QR, call parse_duitnow on its content. If it is a link, call inspect_link.
- Any link in the text or screenshot: call inspect_link.
- If the message claims to be from a bank, Pos, PDRM, LHDN or similar: call official_contact.
- A forwarded APK file is an Android app outside the Play Store: tell the user not to install it.
Each tool result has an evidence_id. The user's own message has evidence_id "${MESSAGE_EVIDENCE_ID}", together with the
scam tactics that code already found in its text.

When you are done investigating, reply with ONLY this JSON (no markdown):
{"risk": "high_risk" | "suspicious" | "no_red_flags_found",
 "language": "ms" if the user wrote in Bahasa Malaysia, otherwise "en",
 "findings": [{"text": "one short sentence in that language", "cites": ["E1"]}],
 "advice": "one or two sentences of what to do next, in that language"}
Rules: every finding must cite at least one evidence_id. Never say something is safe. Do not invent facts that no tool returned.`;

async function toDataUrl(image: Buffer): Promise<string> {
  const jpeg = await sharp(image).rotate().resize({ width: MAX_IMAGE_SIDE_PX, height: MAX_IMAGE_SIDE_PX, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

/** Pulls the JSON answer out of the model's final message. Returns null if it is missing or malformed. */
export function parseAnswer(content: string | null | undefined): ModelAnswer | null {
  const match = content?.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as Partial<ModelAnswer>;
    if (!RISK_LEVELS.includes(raw.risk as never)) return null;
    return {
      risk: raw.risk!,
      language: raw.language === 'ms' ? 'ms' : 'en',
      findings: Array.isArray(raw.findings)
        ? raw.findings.filter((f) => typeof f?.text === 'string' && Array.isArray(f.cites)).map((f) => ({ text: f.text, cites: f.cites.map(String) }))
        : [],
      advice: typeof raw.advice === 'string' ? raw.advice : '',
    };
  } catch {
    return null;
  }
}

export async function investigate(input: Investigation, options: AgentOptions): Promise<Verdict> {
  const images = input.images ?? [];
  const text = input.text?.trim() ?? '';
  const files = input.files ?? [];
  // Code checks of the message itself (text tactics + forwarded files) become evidence MSG.
  const messageSignals = [...checkTactics(text).signals, ...checkAttachments(files)];
  const signalsNote = messageSignals.length > 0
    ? messageSignals.map((s) => `${s.code} (${s.severity})`).join(', ')
    : 'none';
  const filesNote = files.length > 0 ? `\n[Forwarded file(s): ${files.map((f) => `"${f.name}" (${f.mimeType})`).join(', ')}]` : '';
  const userContent: ChatCompletionContentPart[] = [{
    type: 'text',
    text: `${text || '(no text, see attachment)'}\n\n[${images.length} image(s) attached]${filesNote}\n`
      + `[Code check of this message, evidence_id ${MESSAGE_EVIDENCE_ID}: warning signs found: ${signalsNote}]`,
  }];
  for (const image of images) userContent.push({ type: 'image_url', image_url: { url: await toDataUrl(image) } });

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
  const evidence: EvidenceEntry[] = [{ id: MESSAGE_EVIDENCE_ID, tool: 'message_checks', signals: messageSignals }];

  for (let step = 0; step < (options.maxSteps ?? MAX_STEPS); step++) {
    const response = await options.client.chat.completions.create({
      model: options.model,
      messages,
      tools: TOOL_DEFINITIONS,
    });
    const message = response.choices[0]?.message;
    if (!message) break;
    messages.push(message);

    const toolCalls = (message.tool_calls ?? []).filter((c) => c.type === 'function');
    if (toolCalls.length === 0) return decideVerdict(evidence, parseAnswer(message.content));

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        // Bad arguments still get a result, so the model can correct itself on the next step.
      }
      const result = await runTool(call.function.name, args, { images });
      const id = `E${evidence.length}`; // evidence[0] is MSG, so tool results start at E1
      evidence.push({ id, tool: call.function.name, signals: result.signals });
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ evidence_id: id, ...result }) });
    }
  }

  // Out of steps without a final answer: the verdict still stands on the tool evidence alone.
  return decideVerdict(evidence, null);
}
