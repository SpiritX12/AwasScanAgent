// Which model the agent talks to. Both providers speak the OpenAI chat API, so one env switch picks the model.

import OpenAI from 'openai';

export type Provider = 'meta' | 'baseten';

export interface ModelChoice {
  client: OpenAI;
  model: string;
  provider: Provider;
}

const PROVIDERS: Record<Provider, { baseURL: string; keyEnv: string; model: string }> = {
  // Standard mode model (not "-contributor"), so user content is not used for training.
  meta: { baseURL: 'https://api.meta.ai/v1', keyEnv: 'MODEL_API_KEY', model: 'muse-spark-1.3' },
  baseten: { baseURL: 'https://inference.baseten.co/v1', keyEnv: 'BASETEN_API_KEY', model: 'meta-models/muse-spark-open-1026' },
};

export function chooseModel(env: NodeJS.ProcessEnv = process.env): ModelChoice {
  const provider = (env.AGENT_PROVIDER ?? 'meta') as Provider;
  const config = PROVIDERS[provider];
  if (!config) throw new Error(`AGENT_PROVIDER must be "meta" or "baseten", got "${provider}"`);
  const apiKey = env[config.keyEnv];
  if (!apiKey) throw new Error(`${config.keyEnv} is not set (see .env.example)`);
  return { client: new OpenAI({ apiKey, baseURL: config.baseURL, timeout: 60_000, maxRetries: 1 }), model: config.model, provider };
}
