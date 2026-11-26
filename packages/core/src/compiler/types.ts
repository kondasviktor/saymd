import type { TemplateId } from '../types.js';
import { sectionsSchema } from '../types.js';

export type CompilerProviderId = 'gemini' | 'openai' | 'groq' | 'openrouter';

export interface StructuredResult {
  language: string;
  clean: string;
  sections: ReturnType<typeof sectionsSchema.parse>;
}

export interface StructureOptions {
  apiKey: string;
  raw: string;
  template: TemplateId;
  /** Injected only when @saymd/pro is installed and licensed. */
  proAddendum?: string;
}

export interface PromptCompiler {
  id: CompilerProviderId;
  structureTranscript(opts: StructureOptions): Promise<StructuredResult>;
  /** Raw JSON-mode completion; used by Pro (--split) with the same provider and key. */
  generateJson(apiKey: string, prompt: string): Promise<string>;
}
