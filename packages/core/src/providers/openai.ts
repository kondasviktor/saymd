import { createOpenAiCompatibleStt } from './openai-compatible.js';

export function openaiBaseUrl(): string {
  return process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1';
}

/**
 * List prices, USD per minute. gpt-transcribe is the default: OpenAI shuts down whisper-1, gpt-4o-transcribe and
 * gpt-4o-mini-transcribe on 26 Feb 2027 (they still work until then with --model).
 */
export const OPENAI_STT_MODELS: Record<string, number> = {
  'gpt-transcribe': 0.0045,
  'gpt-4o-transcribe': 0.006,
  'gpt-4o-mini-transcribe': 0.003,
  'whisper-1': 0.006,
};

export const openaiProvider = createOpenAiCompatibleStt({
  id: 'openai',
  displayName: 'OpenAI',
  baseUrl: openaiBaseUrl,
  defaultModel: 'gpt-transcribe',
  modelEnvVar: 'OPENAI_TRANSCRIBE_MODEL',
  knownModels: OPENAI_STT_MODELS,
});
