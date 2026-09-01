import { deepgramProvider } from './deepgram.js';
import { elevenlabsProvider } from './elevenlabs.js';
import { geminiProvider } from './gemini.js';
import { openaiProvider } from './openai.js';
import { STT_PROVIDER_IDS, type SttProviderId, type TranscriptionProvider } from './types.js';

export type { SttProviderId, Transcript, TranscriptionProvider } from './types.js';
export { STT_ONLY_PROVIDERS, STT_PROVIDER_IDS } from './types.js';
export { createMockProvider } from './mock.js';

const PROVIDERS: Record<SttProviderId, TranscriptionProvider> = {
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

export function estimateCostUsd(providerId: SttProviderId, durationSeconds: number): number {
  const provider = getProvider(providerId);
  return Math.max(0.001, (durationSeconds / 60) * provider.usdPerMinute);
}

export function providerLabel(id: SttProviderId): string {
  return getProvider(id).displayName;
}
