import { structureTranscript, type CompilerProviderId, type ProviderKeys } from './compiler/index.js';
import { normalizeKnownAsr } from './asr-normalize.js';
import { sectionsToMarkdown } from './markdown.js';
import { estimateCostUsd, getProvider, resolveSttModel } from './providers/index.js';
import type { SttProviderId, Transcript } from './providers/types.js';
import { polishStructuredSections } from './structure-polish.js';
import type { SaymdSections, TemplateId } from './types.js';

export interface TranscribeAudioOptions {
  provider: SttProviderId;
  apiKey: string;
  /** A file path (CLI) or bytes (cloud). */
  audio: { localPath?: string; data?: Uint8Array; filename?: string; mimeType: string };
  durationSeconds?: number;
  lang?: string;
  model?: string;
  vocabulary?: string[];
}

export interface TranscribedAudio extends Transcript {
  /** Transcript with known ASR mishearings fixed (e.g. "Saint MD" → "saymd"). */
  raw: string;
  estimatedCostUsd?: number;
}

/** Speech to text on one audio file or buffer. Long files are chunked by the caller (CLI: ffmpeg). */
export async function transcribeAudio(opts: TranscribeAudioOptions): Promise<TranscribedAudio> {
  const model = opts.model?.trim() || resolveSttModel(opts.provider);
  const transcript = await getProvider(opts.provider).transcribeFile(opts.apiKey, {
    ...opts.audio,
    lang: opts.lang,
    model,
    vocabulary: opts.vocabulary,
    durationSeconds: opts.durationSeconds,
  });
  return {
    ...transcript,
    raw: normalizeKnownAsr(transcript.text),
    // The provider's own figure when it reports one (OpenRouter), else the list-price estimate.
    estimatedCostUsd:
      transcript.costUsd ??
      (opts.durationSeconds !== undefined ? estimateCostUsd(opts.provider, opts.durationSeconds, transcript.model) : undefined),
  };
}

export interface CompiledSpec {
  language: string;
  clean: string;
  sections: SaymdSections;
  markdown: string;
}

/**
 * Transcript → structured spec, the same way for the CLI and the cloud: structure with the
 * provider's LLM, then deterministic polish, then Markdown.
 */
export async function compileSpec(opts: {
  sttProvider: SttProviderId;
  keys: ProviderKeys;
  raw: string;
  template: TemplateId;
  /** Pro prompt lines: --out, vocab, --ground. */
  addendum?: string;
  /** Structure with this provider instead of the one paired with the STT provider (Pro Cloud setting). */
  structuringProvider?: CompilerProviderId;
}): Promise<CompiledSpec> {
  const structured = await structureTranscript(opts.sttProvider, opts.keys, {
    preferred: opts.structuringProvider,
    raw: opts.raw,
    template: opts.template,
    proAddendum: opts.addendum,
  });
  const sections = polishStructuredSections(opts.raw, structured.sections, opts.template);
  return {
    language: structured.language,
    clean: normalizeKnownAsr(structured.clean || opts.raw),
    sections,
    markdown: renderSpec(sections, opts.template),
  };
}

/** Sections → the spec Markdown agents read. */
export function renderSpec(sections: SaymdSections, template: TemplateId): string {
  return normalizeKnownAsr(sectionsToMarkdown(sections, template));
}
