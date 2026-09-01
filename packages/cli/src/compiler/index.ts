import type { SaymdConfig } from '../config.js';
import type { SttProviderId } from '../providers/types.js';
import { geminiCompiler } from './gemini.js';
import { openaiCompiler } from './openai.js';
import type { CompilerProviderId, PromptCompiler } from './types.js';

export type { CompilerProviderId, PromptCompiler, StructuredResult, StructureOptions } from './types.js';

const COMPILERS: Record<CompilerProviderId, PromptCompiler> = {
  gemini: geminiCompiler,
  openai: openaiCompiler,
};

export function getCompiler(id: CompilerProviderId): PromptCompiler {
  return COMPILERS[id];
}

/** Pick compiler: same provider when gemini/openai; otherwise prefer Gemini key, then OpenAI. */
export function resolveCompilerProvider(
  sttProvider: SttProviderId,
  config: SaymdConfig
): CompilerProviderId {
  if (sttProvider === 'gemini') return 'gemini';
  if (sttProvider === 'openai') return 'openai';
  if (resolveGeminiKey(config)) return 'gemini';
  if (resolveOpenaiKey(config)) return 'openai';
  throw new Error(
    'Deepgram and ElevenLabs are STT-only. Add a Gemini or OpenAI key for prompt structuring:\n  saymd setup'
  );
}

export function resolveCompilerApiKey(
  compilerProvider: CompilerProviderId,
  config: SaymdConfig
): string | undefined {
  if (compilerProvider === 'gemini') return resolveGeminiKey(config);
  return resolveOpenaiKey(config);
}

function resolveGeminiKey(config: SaymdConfig): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || config.geminiApiKey?.trim() || undefined;
}

function resolveOpenaiKey(config: SaymdConfig): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || config.openaiApiKey?.trim() || undefined;
}

export async function structureTranscript(
  sttProvider: SttProviderId,
  config: SaymdConfig,
  opts: Omit<import('./types.js').StructureOptions, 'apiKey'>
): Promise<import('./types.js').StructuredResult> {
  const compilerProvider = resolveCompilerProvider(sttProvider, config);
  const apiKey = resolveCompilerApiKey(compilerProvider, config);
  if (!apiKey) {
    throw new Error(
      `${compilerProvider === 'gemini' ? 'GEMINI' : 'OPENAI'}_API_KEY not set. Run: saymd setup`
    );
  }
  const compiler = getCompiler(compilerProvider);
  return compiler.structureTranscript({ ...opts, apiKey });
}
