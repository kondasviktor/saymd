import { deepgramProvider } from './deepgram.js';
import { elevenlabsProvider } from './elevenlabs.js';
import { geminiProvider } from './gemini.js';
import { groqProvider } from './groq.js';
import { openaiProvider } from './openai.js';
import { STT_PROVIDER_IDS, type SttProviderId, type TranscriptionProvider } from './types.js';

export type { SttProviderId, Transcript, TranscriptionProvider } from './types.js';
export { RECOMMENDED_PROVIDER, STT_ONLY_PROVIDERS, STT_PROVIDER_IDS } from './types.js';
export { createMockProvider } from './mock.js';

const PROVIDERS: Record<SttProviderId, TranscriptionProvider> = {
  groq: groqProvider,
  gemini: geminiProvider,
  openai: openaiProvider,
  deepgram: deepgramProvider,
  elevenlabs: elevenlabsProvider,
};

export function getProvider(id: SttProviderId): TranscriptionProvider {
  return PROVIDERS[id];
}

export function listProviders(): TranscriptionProvider[] {
  return STT_PROVIDER_IDS.map((id) => PROVIDERS[id]);
}

/**
 * Effective STT model: `--model` flag, then the provider's env var
 * (e.g. OPENAI_TRANSCRIBE_MODEL), then `saymd config set model`, then the default.
 */
export function resolveSttModel(
  id: SttProviderId,
  configModels?: Partial<Record<SttProviderId, string>>,
  cliModel?: string
): string {
  const provider = getProvider(id);
  const fromEnv = provider.modelEnvVar ? process.env[provider.modelEnvVar]?.trim() : undefined;
  return cliModel?.trim() || fromEnv || configModels?.[id]?.trim() || provider.model;
}

/** True when the model is in the provider's known price list. Unknown models still run (e.g. via OPENAI_BASE_URL). */
export function isKnownModel(id: SttProviderId, model: string): boolean {
  const known = getProvider(id).knownModels;
  return !known || model in known;
}

export function usdPerMinuteFor(id: SttProviderId, model?: string): number {
  const provider = getProvider(id);
  if (model && provider.knownModels?.[model] !== undefined) return provider.knownModels[model];
  return provider.usdPerMinute;
}

export function estimateCostUsd(
  providerId: SttProviderId,
  durationSeconds: number,
  model?: string,
  requests = 1
): number {
  const provider = getProvider(providerId);
  const billedSeconds = Math.max(durationSeconds, (provider.minBilledSeconds ?? 0) * requests);
  return Math.max(0.001, (billedSeconds / 60) * usdPerMinuteFor(providerId, model));
}

export function providerLabel(id: SttProviderId): string {
  return getProvider(id).displayName;
}
