// The tools the agent may call: their JSON schemas for the model, and how each call runs.

import type { ChatCompletionFunctionTool } from 'openai/resources/chat/completions';
import type { ToolResult } from '../evidence.ts';
import { parseDuitNow } from './duitnow.ts';
import { inspectLink } from './link.ts';
import { officialContact } from './official.ts';
import { decodeQr } from './qr.ts';

export const TOOL_DEFINITIONS: ChatCompletionFunctionTool[] = [
  {
    type: 'function',
    function: {
      name: 'decode_qr',
      description: 'Read the QR code in one of the attached images. Returns its kind (payment_qr, link, text) and content.',
      parameters: {
        type: 'object',
        properties: { image_index: { type: 'integer', description: '0-based index of the attached image' } },
        required: ['image_index'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'parse_duitnow',
      description: 'Parse a DuitNow / EMV payment QR payload (starts with 000201): who gets paid, amount, and whether the checksum shows tampering.',
      parameters: { type: 'object', properties: { payload: { type: 'string' } }, required: ['payload'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inspect_link',
      description: 'Check a link: lookalike of a Malaysian brand, tricks in the address, where it redirects, and how new the domain is.',
      parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'official_contact',
      description: 'Official websites of an organisation the message claims to be from (bank, Pos, PDRM, LHDN...), plus the national scam hotline.',
      parameters: { type: 'object', properties: { organisation: { type: 'string' } }, required: ['organisation'] },
    },
  },
];

export interface ToolContext {
  images: Buffer[];
}

export async function runTool(name: string, args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
  switch (name) {
    case 'decode_qr': {
      const image = context.images[Number(args.image_index ?? 0)];
      if (!image) return { ok: false, signals: [], data: { error: 'no image at that index' } };
      return decodeQr(image);
    }
    case 'parse_duitnow':
      return parseDuitNow(String(args.payload ?? ''));
    case 'inspect_link':
      return inspectLink(String(args.url ?? ''));
    case 'official_contact':
      return officialContact(String(args.organisation ?? ''));
    default:
      return { ok: false, signals: [], data: { error: `unknown tool ${name}` } };
  }
}
