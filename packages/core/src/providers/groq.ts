import { createOpenAiCompatibleStt } from './openai-compatible.js';

export function groqBaseUrl(): string {
  return process.env.GROQ_BASE_URL?.trim() || 'https://api.groq.com/openai/v1';
}

/**
 * Groq Whisper. Free tier needs no card (rate-limited, 25 MB per file).
 * List prices: v3 turbo $0.04/hr, v3 $0.111/hr; minimum 10 s billed per request.
 */
export const GROQ_STT_MODELS: Record<string, number> = {
  'whisper-large-v3-turbo': 0.04 / 60,
  'whisper-large-v3': 0.111 / 60,
};

export const groqProvider = createOpenAiCompatibleStt({
  id: 'groq',
  displayName: 'Groq',
  baseUrl: groqBaseUrl,
  defaultModel: 'whisper-large-v3-turbo',
  modelEnvVar: 'GROQ_TRANSCRIBE_MODEL',
  knownModels: GROQ_STT_MODELS,
  minBilledSeconds: 10,
});
