export type SttProviderId = 'groq' | 'gemini' | 'openai' | 'deepgram' | 'elevenlabs';

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
  /** STT model override (`--model`, env or `saymd config set model`). */
  model?: string;
  /** Terms to bias recognition towards (providers that support it; Gemini Transcribe). */
  vocabulary?: string[];
}

export interface TranscriptionProvider {
  id: SttProviderId;
  displayName: string;
  /** Default model (env override applied). */
  model: string;
  /** Price of the default model. */
  usdPerMinute: number;
  /** Known models for this provider and their list price in USD per minute. */
  knownModels?: Record<string, number>;
  /** Env var that overrides the default model, e.g. OPENAI_TRANSCRIBE_MODEL. */
  modelEnvVar?: string;
  /** Providers bill a minimum duration per request (Groq: 10 s). */
  minBilledSeconds?: number;
  verifyApiKey(apiKey: string): Promise<void>;
  transcribeFile(apiKey: string, opts: TranscribeOptions): Promise<Transcript>;
  chunkAndTranscribe(
    apiKey: string,
    chunkPaths: string[],
    mimeType: string,
    lang?: string,
    model?: string,
    vocabulary?: string[]
  ): Promise<Transcript>;
}

/** Order shown in `saymd setup`. Groq first: free tier, no card needed. */
export const STT_PROVIDER_IDS: SttProviderId[] = ['groq', 'gemini', 'openai', 'deepgram', 'elevenlabs'];

/** Providers that only transcribe; structuring needs a Gemini, OpenAI or Groq key. */
export const STT_ONLY_PROVIDERS: SttProviderId[] = ['deepgram', 'elevenlabs'];

/** Provider recommended to new free users in `saymd setup`. */
export const RECOMMENDED_PROVIDER: SttProviderId = 'groq';
