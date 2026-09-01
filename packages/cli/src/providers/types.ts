export type SttProviderId = 'gemini' | 'openai' | 'deepgram' | 'elevenlabs';

export interface Transcript {
  text: string;
  language?: string;
  durationSeconds?: number;
  provider: SttProviderId;
  model: string;
}

export interface TranscribeOptions {
  localPath: string;
  mimeType: string;
  lang?: string;
  durationSeconds?: number;
}

export interface TranscriptionProvider {
  id: SttProviderId;
  displayName: string;
  model: string;
  usdPerMinute: number;
  verifyApiKey(apiKey: string): Promise<void>;
  transcribeFile(apiKey: string, opts: TranscribeOptions): Promise<Transcript>;
  chunkAndTranscribe(
    apiKey: string,
    chunkPaths: string[],
    mimeType: string,
    lang?: string
  ): Promise<Transcript>;
}

export const STT_PROVIDER_IDS: SttProviderId[] = ['gemini', 'openai', 'deepgram', 'elevenlabs'];

export const STT_ONLY_PROVIDERS: SttProviderId[] = ['deepgram', 'elevenlabs'];
