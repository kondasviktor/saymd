import type { TemplateId } from '../types.js';
import { sectionsSchema } from '../types.js';

export type CompilerProviderId = 'gemini' | 'openai';

export interface StructuredResult {
  language: string;
  clean: string;
  sections: ReturnType<typeof sectionsSchema.parse>;
}

export interface StructureOptions {
  apiKey: string;
  raw: string;
  template: TemplateId;
  vocab: string[];
  outLang?: string;
}

export interface PromptCompiler {
  id: CompilerProviderId;
  structureTranscript(opts: StructureOptions): Promise<StructuredResult>;
}
