import type { SttProviderId } from '../providers/types.js';
import { geminiCompiler } from './gemini.js';
import { groqCompiler, openaiCompiler } from './openai.js';
import type { CompilerProviderId, PromptCompiler } from './types.js';

export type { CompilerProviderId, PromptCompiler, StructuredResult, StructureOptions } from './types.js';

/** API keys by provider. The CLI fills this from its config file and env; the cloud from its server key. */
export type ProviderKeys = Partial<Record<SttProviderId, string>>;

const COMPILERS: Record<CompilerProviderId, PromptCompiler> = {
  gemini: geminiCompiler,
  openai: openaiCompiler,
  groq: groqCompiler,
};

export function getCompiler(id: CompilerProviderId): PromptCompiler {
  return COMPILERS[id];
}

/**
 * Pick compiler: same provider when the STT provider also has an LLM (gemini, openai, groq);
 * otherwise prefer a Gemini key, then OpenAI, then Groq.
 */
export function resolveCompilerProvider(sttProvider: SttProviderId, keys: ProviderKeys): CompilerProviderId {
  if (sttProvider === 'gemini' || sttProvider === 'openai' || sttProvider === 'groq') return sttProvider;
  if (keys.gemini) return 'gemini';
  if (keys.openai) return 'openai';
  if (keys.groq) return 'groq';
  throw new Error(
    'Deepgram and ElevenLabs are STT-only. Add a Gemini, OpenAI or Groq key for prompt structuring:\n  saymd setup'
  );
}

export function resolveCompilerApiKey(compilerProvider: CompilerProviderId, keys: ProviderKeys): string | undefined {
  return keys[compilerProvider]?.trim() || undefined;
}

export function compilerKeyEnvName(compilerProvider: CompilerProviderId): string {
  return `${compilerProvider.toUpperCase()}_API_KEY`;
}

/** JSON-mode LLM on the structuring provider, for Pro features such as --split. */
export function createJsonLlm(
  sttProvider: SttProviderId,
  keys: ProviderKeys
): { provider: CompilerProviderId; llm: (prompt: string) => Promise<string> } {
  const provider = resolveCompilerProvider(sttProvider, keys);
  const apiKey = resolveCompilerApiKey(provider, keys);
  if (!apiKey) throw new Error(`${compilerKeyEnvName(provider)} not set. Run: saymd setup`);
  const compiler = getCompiler(provider);
  return { provider, llm: (prompt) => compiler.generateJson(apiKey, prompt) };
}

export async function structureTranscript(
  sttProvider: SttProviderId,
  keys: ProviderKeys,
  opts: Omit<import('./types.js').StructureOptions, 'apiKey'>
): Promise<import('./types.js').StructuredResult> {
  const compilerProvider = resolveCompilerProvider(sttProvider, keys);
  const apiKey = resolveCompilerApiKey(compilerProvider, keys);
  if (!apiKey) {
    throw new Error(`${compilerKeyEnvName(compilerProvider)} not set. Run: saymd setup`);
  }
  const compiler = getCompiler(compilerProvider);
  return compiler.structureTranscript({ ...opts, apiKey });
}
