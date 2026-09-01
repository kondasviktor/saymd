import type { TranscribeOptions, Transcript, TranscriptionProvider } from './types.js';

/** In-memory mock for tests — no network calls. */
export function createMockProvider(text = 'mock transcript'): TranscriptionProvider {
  return {
    id: 'gemini',
    displayName: 'Mock',
    model: 'mock-transcribe',
    usdPerMinute: 0.005,
    async verifyApiKey(): Promise<void> {
      /* noop */
    },
    async transcribeFile(_apiKey: string, opts: TranscribeOptions): Promise<Transcript> {
      return {
        text,
        language: 'en',
        provider: 'gemini',
        model: 'mock-transcribe',
        durationSeconds: opts.durationSeconds,
      };
    },
    async chunkAndTranscribe(): Promise<Transcript> {
      return {
        text,
        language: 'en',
        provider: 'gemini',
        model: 'mock-transcribe',
      };
    },
  };
}
