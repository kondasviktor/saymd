/**
 * @saymd/core — the saymd pipeline shared by the CLI and Pro Cloud:
 * speech-to-text providers, transcript structuring, and spec Markdown.
 * No config files, no ffmpeg, no Pro features: callers pass keys and audio.
 */
export * from './types.js';
export * from './providers/index.js';
export type { TranscribeOptions } from './providers/types.js';
export { isDedicatedTranscribeModel, transcribeVocabulary } from './providers/gemini.js';
export { GEMINI_DEFAULT_TEXT_MODEL, geminiClient, geminiTextModel } from './providers/gemini-client.js';
export { OPENAI_STT_MODELS } from './providers/openai.js';
export { GROQ_STT_MODELS } from './providers/groq.js';
export { OPENROUTER_STT_MODELS, openrouterAudioFormat } from './providers/openrouter.js';
export {
  compilerKeyEnvName,
  createJsonLlm,
  getCompiler,
  resolveCompilerApiKey,
  resolveCompilerProvider,
  structureTranscript,
} from './compiler/index.js';
export type { CompilerProviderId, PromptCompiler, ProviderKeys, StructuredResult, StructureOptions } from './compiler/index.js';
export { GROQ_DEFAULT_STRUCTURE_MODEL, OPENROUTER_DEFAULT_STRUCTURE_MODEL } from './compiler/openai.js';
export { freeCompilerRules, freeCompilerReminder } from './compiler/rules.js';
export { structureSchemaHint } from './templates.js';
export { parseMarkdownSections, sectionsToMarkdown } from './markdown.js';
export { normalizeKnownAsr } from './asr-normalize.js';
export { polishStructuredSections, polishTaskSections, recoverContextFromTranscript } from './structure-polish.js';
export { compileSpec, renderSpec, transcribeAudio } from './pipeline.js';
export type { CompiledSpec, TranscribeAudioOptions, TranscribedAudio } from './pipeline.js';
