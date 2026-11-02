// Runs the synthetic test set (eval/cases.json) through the agent on one or both models and writes
// eval/results.md. Makes live API calls: about 3-4 per case per model.
// Usage: node --env-file=.env scripts/eval.ts [meta|baseten|both]   (default: both)

import { readFile, writeFile } from 'node:fs/promises';
import { SYNTHETIC_IMAGES } from '../eval/images.ts';
import { investigate } from '../src/agent.ts';
import { chooseModel, type Provider } from '../src/model.ts';
import type { Risk } from '../src/verdict.ts';

const CONCURRENCY = 3;

interface Case {
  id: string;
  label: 'scam' | 'legit';
  pattern: string;
  text: string;
  image?: string;
  file?: { name: string; mimeType: string }; // a forwarded file: only name and type are used
}

interface Outcome {
  id: string;
  label: Case['label'];
  risk: Risk | 'error';
  seconds: number;
  tools: string[];
}

async function runCase(testCase: Case, provider: Provider): Promise<Outcome> {
  const started = Date.now();
  const outcome = (risk: Outcome['risk'], tools: string[] = []): Outcome =>
    ({ id: testCase.id, label: testCase.label, risk, tools, seconds: (Date.now() - started) / 1000 });
  try {
    const model = chooseModel({ ...process.env, AGENT_PROVIDER: provider });
    const images = testCase.image ? [await SYNTHETIC_IMAGES[testCase.image]()] : [];
    const files = testCase.file ? [testCase.file] : [];
    const verdict = await investigate({ text: testCase.text, images, files }, { client: model.client, model: model.model });
    return outcome(verdict.risk, verdict.tools);
  } catch (error) {
    console.error(`  ${testCase.id}: ${error instanceof Error ? error.name : 'error'}`);
    return outcome('error');
  }
}

async function runAll(cases: Case[], provider: Provider): Promise<Outcome[]> {
  const results: Outcome[] = new Array(cases.length);
  let next = 0;
  const worker = async () => {
    while (next < cases.length) {
      const index = next++;
      results[index] = await runCase(cases[index], provider);
      console.log(`  [${provider}] ${cases[index].id}: ${results[index].risk} (${results[index].seconds.toFixed(1)}s)`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

function summarise(outcomes: Outcome[]) {
  const scams = outcomes.filter((o) => o.label === 'scam');
  const legit = outcomes.filter((o) => o.label === 'legit');
  const flagged = (o: Outcome) => o.risk === 'high_risk' || o.risk === 'suspicious';
  const times = outcomes.map((o) => o.seconds).sort((a, b) => a - b);
  return {
    caught: `${scams.filter(flagged).length}/${scams.length}`,
    highRisk: `${scams.filter((o) => o.risk === 'high_risk').length}/${scams.length}`,
    falseAlarms: `${legit.filter(flagged).length}/${legit.length}`,
    errors: outcomes.filter((o) => o.risk === 'error').length,
    medianSeconds: times[Math.floor(times.length / 2)].toFixed(1),
  };
}

const MODEL_NAMES: Record<Provider, string> = { meta: 'Muse Spark 1.3 (Meta API)', baseten: 'Muse Spark Open (Baseten)' };

const arg = process.argv[2] ?? 'both';
const providers: Provider[] = arg === 'both' ? ['meta', 'baseten'] : [arg as Provider];
const cases = JSON.parse(await readFile(new URL('../eval/cases.json', import.meta.url), 'utf8')) as Case[];

const byProvider = new Map<Provider, Outcome[]>();
for (const provider of providers) {
  console.log(`Running ${cases.length} cases on ${provider}...`);
  byProvider.set(provider, await runAll(cases, provider));
}

const lines = [
  '# Eval results',
  '',
  `${cases.length} synthetic cases (${cases.filter((c) => c.label === 'scam').length} scam, ${cases.filter((c) => c.label === 'legit').length} legitimate), run ${new Date().toISOString().slice(0, 10)}.`,
  'A scam counts as caught when the verdict is "suspicious" or "high risk". A false alarm is a legitimate message flagged either way.',
  '',
  '| Model | Scams caught | Of those, high risk | False alarms | Errors | Median time |',
  '|---|---|---|---|---|---|',
  ...[...byProvider].map(([p, o]) => { const s = summarise(o); return `| ${MODEL_NAMES[p]} | ${s.caught} | ${s.highRisk} | ${s.falseAlarms} | ${s.errors} | ${s.medianSeconds}s |`; }),
  '',
  '## Per case',
  '',
  `| Case | Expected | ${providers.map((p) => MODEL_NAMES[p]).join(' | ')} |`,
  `|---|---|${providers.map(() => '---').join('|')}|`,
  ...cases.map((c, i) => `| ${c.id} (${c.pattern}) | ${c.label} | ${providers.map((p) => {
    const o = byProvider.get(p)![i];
    return `${o.risk}${o.tools.length ? ` · ${o.tools.join(', ')}` : ''}`;
  }).join(' | ')} |`),
  '',
];
await writeFile(new URL('../eval/results.md', import.meta.url), lines.join('\n'));
console.log('\n' + lines.slice(5, 7 + byProvider.size).join('\n'));
console.log('\nWrote eval/results.md');
