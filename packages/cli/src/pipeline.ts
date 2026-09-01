import { writeFile, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { mkdir } from 'node:fs/promises';

import { cleanupAudio, normalizeAudio, recordMic, splitLongAudio } from './audio.js';
import { structureTranscript } from './compiler/index.js';
import {
  loadVocab,
  resolveSttApiKey,
  loadConfig,
  resolveProvider,
  sttKeyEnvName,
} from './config.js';
import { estimateCostUsd, getProvider, providerLabel } from './providers/index.js';
import { sectionsToMarkdown } from './markdown.js';
import type { CliOptions, SaymdResult } from './types.js';
import type { SttProviderId } from './providers/types.js';

const MAX_FILE_MINUTES = 20;

export async function runPipeline(opts: CliOptions, cwd: string): Promise<SaymdResult> {
  const config = await loadConfig();
  const providerId = resolveProvider(config, opts.provider);
  const provider = getProvider(providerId);
  const sttApiKey = resolveSttApiKey(providerId, config);
  if (!sttApiKey) {
    throw new Error(`${sttKeyEnvName(providerId)} not set. Run: saymd setup`);
  }

  const projectCfg = await import('./config.js').then((m) => m.loadProjectConfig(cwd));
  const outLang = opts.outLang ?? projectCfg.out;
  const lang = opts.lang ?? projectCfg.in;
  const vocab = await loadVocab(cwd);

  let probe = opts.file
    ? await normalizeAudio(opts.file)
    : await recordMic(opts.recordSeconds);

  if (probe.durationSeconds > MAX_FILE_MINUTES * 60) {
    throw new Error(
      `Audio is ${Math.ceil(probe.durationSeconds / 60)} min — max ${MAX_FILE_MINUTES} min in v1. Split the file or record a shorter clip.`
    );
  }

  let chunkTemp: string | undefined;
  try {
    const { chunkPaths, tempDir } = await splitLongAudio(probe.localPath);
    chunkTemp = tempDir !== probe.tempDir ? tempDir : undefined;

    const transcript =
      chunkPaths.length > 1
        ? await provider.chunkAndTranscribe(sttApiKey, chunkPaths, probe.mimeType, lang)
        : await provider.transcribeFile(sttApiKey, {
            localPath: probe.localPath,
            mimeType: probe.mimeType,
            lang,
            durationSeconds: probe.durationSeconds,
          });

    const structured = await structureTranscript(providerId, config, {
      raw: transcript.text,
      template: opts.template,
      vocab,
      outLang,
    });

    const markdown = sectionsToMarkdown(structured.sections, opts.template);
    const durationSeconds = probe.durationSeconds;

    return {
      raw: transcript.text,
      clean: structured.clean || transcript.text,
      language: structured.language,
      sections: structured.sections,
      markdown,
      durationSeconds,
      estimatedCostUsd: estimateCostUsd(providerId, durationSeconds),
      provider: providerId,
      sttModel: transcript.model,
    };
  } finally {
    if (!opts.file) {
      // keep temp on failure — caller handles; success path cleans below
    }
    void chunkTemp;
  }
}

export async function writeOutput(
  result: SaymdResult,
  opts: CliOptions,
  cwd: string,
  keepTempPath?: string
): Promise<{ outputPath: string; keptTemp?: string }> {
  const outputPath = join(cwd, opts.output);
  await mkdir(dirname(outputPath), { recursive: true });

  if (opts.dryRun) {
    console.log('[dry-run] Would write:', outputPath);
    console.log(result.markdown);
    return { outputPath };
  }

  const backup = outputPath + '.bak';
  try {
    await copyFile(outputPath, backup);
  } catch {
    /* no existing file */
  }

  await writeFile(outputPath, result.markdown, 'utf8');
  await cleanupAudio(undefined);
  return { outputPath, keptTemp: keepTempPath };
}

export function printCostLine(result: SaymdResult): void {
  const min = (result.durationSeconds / 60).toFixed(1);
  const label = providerLabel(result.provider);
  console.error(
    `Audio: ${min} min · est. ${label} cost: ~$${result.estimatedCostUsd.toFixed(3)} (BYOK)`
  );
}

export { type SttProviderId };
