// Live smoke test: one real investigation against the configured model. Costs a few cents; run by hand only.
// Usage: npm run smoke            (Muse Spark 1.3)
//        AGENT_PROVIDER=baseten npm run smoke   (Muse Spark Open on Baseten)

import { investigate } from '../src/agent.ts';
import { chooseModel } from '../src/model.ts';
import { formatReply } from '../src/verdict.ts';

// Synthetic scam message; the domain is made up for testing.
const SAMPLE = 'Maybank: Akaun anda telah dibekukan. Sila sahkan dalam 24 jam di http://maybank2u-sahkan-akaun.com/login atau akaun akan ditutup.';

const { client, model, provider } = chooseModel();
const started = Date.now();
const verdict = await investigate({ text: SAMPLE }, { client, model });
console.log(`provider=${provider} model=${model} risk=${verdict.risk} seconds=${((Date.now() - started) / 1000).toFixed(1)}`);
console.log('---');
console.log(formatReply(verdict));
