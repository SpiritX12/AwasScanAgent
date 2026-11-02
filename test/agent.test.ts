import type OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import { investigate, parseAnswer } from '../src/agent.ts';

/** A fake chat client that returns scripted assistant messages, one per call, and records what it was sent. */
function scriptedClient(replies: object[]) {
  const requests: { messages: { role: string }[] }[] = [];
  const client = {
    chat: {
      completions: {
        create: async (request: { messages: { role: string }[] }) => {
          requests.push(structuredClone(request));
          return { choices: [{ message: { role: 'assistant', ...replies[requests.length - 1] } }] };
        },
      },
    },
  } as unknown as OpenAI;
  return { client, requests };
}

describe('investigate', () => {
  it('runs a tool, gives the model its evidence id, and builds the verdict from cited findings', async () => {
    const { client, requests } = scriptedClient([
      { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'official_contact', arguments: '{"organisation":"Maybank"}' } }] },
      { content: '{"risk":"suspicious","language":"en","findings":[{"text":"Claims to be Maybank","cites":["E1","MSG"]}],"advice":"Use the app."}' },
    ]);

    const verdict = await investigate({ text: 'Maybank: verify your account now' }, { client, model: 'test' });

    const toolMessage = requests[1].messages.find((m) => m.role === 'tool') as unknown as { content: string };
    expect(JSON.parse(toolMessage.content)).toMatchObject({ evidence_id: 'E1', data: { organisation: 'Maybank' } });
    expect(verdict.risk).toBe('suspicious');
    expect(verdict.findings).toHaveLength(1);
  });

  it('stops after the step limit and still returns a verdict', async () => {
    const loop = { content: null, tool_calls: [{ id: 'c', type: 'function', function: { name: 'official_contact', arguments: '{}' } }] };
    const { client, requests } = scriptedClient([loop, loop, loop]);
    const verdict = await investigate({ text: 'hello' }, { client, model: 'test', maxSteps: 3 });
    expect(requests).toHaveLength(3);
    expect(verdict.risk).toBe('no_red_flags_found');
  });
});

describe('parseAnswer', () => {
  it('reads JSON wrapped in extra text', () => {
    expect(parseAnswer('Here you go:\n{"risk":"high_risk","language":"ms","findings":[],"advice":"x"}')?.risk).toBe('high_risk');
  });
  it('rejects an unknown risk such as "safe"', () => {
    expect(parseAnswer('{"risk":"safe","findings":[]}')).toBeNull();
  });
});
