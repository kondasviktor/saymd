import { writeFile, copyFile } from 'node:fs/promises';
import { dirname } from 'node:path';
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
import { normalizeKnownAsr } from './asr-normalize.js';
import { polishStructuredSections } from './structure-polish.js';
import { resolveUserPath } from './paths.js';
import type { CliOptions, SaymdResult } from './types.js';
import type { SttProviderId } from './providers/types.js';
import {
  FREE_MAX_SECONDS,
  PRO_MAX_MIC_SECONDS,
  PRO_UPGRADE_URL,
  getProCompilerAddendum,
  getProRecordingLimits,
} from './pro-gate.js';

function printFreeDurationHint(): void {
  process.stderr.write(
    `Free: up to ${FREE_MAX_SECONDS}s per recording. Pro: up to ${PRO_MAX_MIC_SECONDS / 60} min per recording, plus --continue → ${PRO_UPGRADE_URL}\n`
  );
}

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
  const proLimits = await getProRecordingLimits();
  const isPro = Boolean(proLimits);
  if (vocab.length > 0 && !isPro) {
    process.stderr.write(
      `.saymd/vocab.txt is Pro — ignored this run. Upgrade → ${PRO_UPGRADE_URL}\n`
    );
  }
  if (outLang && !isPro && !opts.outLang) {
    process.stderr.write(
      `.saymd/config.json "out" is Pro — ignored this run. Upgrade → ${PRO_UPGRADE_URL}\n`
    );
  }
  const proAddendum = isPro ? await getProCompilerAddendum({ vocab, outLang }) : '';
  const maxMic = proLimits?.maxMicSeconds ?? FREE_MAX_SECONDS;
  const maxFile = proLimits?.maxFileSeconds ?? FREE_MAX_SECONDS;
  const defaultMic = proLimits?.defaultSeconds ?? FREE_MAX_SECONDS;

  let probe;
  if (opts.file) {
    const filePath = resolveUserPath(cwd, opts.file);
    process.stderr.write(`Reading ${opts.file}…\n`);
    probe = await normalizeAudio(filePath);
  } else {
    let seconds = opts.recordSeconds;
    if (!Number.isFinite(seconds) || seconds <= 0) seconds = defaultMic;
    if (seconds > maxMic) {
      if (!isPro) {
        printFreeDurationHint();
        seconds = maxMic;
      } else {
        throw new Error(
          `Pro mic max is ${maxMic / 60} min. Use --file for longer audio (max ${maxFile / 60} min).`
        );
      }
    } else if (!isPro && opts.recordSeconds > FREE_MAX_SECONDS) {
      printFreeDurationHint();
      seconds = FREE_MAX_SECONDS;
    }
    process.stderr.write(
      `\n● Recording (max ${seconds}s) — speak now. Press Enter to stop.\n` +
        `  Ctrl+C to cancel.\n\n`
    );
    probe = await recordMic(seconds);
    process.stderr.write(`● Recorded ${probe.durationSeconds.toFixed(1)}s — transcribing…\n`);
  }

  if (probe.durationSeconds > maxFile) {
    if (!isPro) {
      throw new Error(
        `Free is ${FREE_MAX_SECONDS}s per take (this file is ${Math.ceil(probe.durationSeconds)}s). Trim the audio or upgrade → ${PRO_UPGRADE_URL}`
      );
    }
    throw new Error(
      `Audio is ${Math.ceil(probe.durationSeconds / 60)} min — max ${maxFile / 60} min. Split the file or record a shorter clip.`
    );
  }

  let chunkTemp: string | undefined;
  try {
    const { chunkPaths, tempDir } = await splitLongAudio(probe.localPath);
    chunkTemp = tempDir !== probe.tempDir ? tempDir : undefined;

    process.stderr.write(`Transcribing via ${providerLabel(providerId)}…\n`);
    const transcript =
      chunkPaths.length > 1
        ? await provider.chunkAndTranscribe(sttApiKey, chunkPaths, probe.mimeType, lang)
        : await provider.transcribeFile(sttApiKey, {
            localPath: probe.localPath,
            mimeType: probe.mimeType,
            lang,
            durationSeconds: probe.durationSeconds,
          });

    const rawText = normalizeKnownAsr(transcript.text);

    process.stderr.write('Structuring into markdown…\n');
    const structured = await structureTranscript(providerId, config, {
      raw: rawText,
      template: opts.template,
      proAddendum,
    });

    const sections = polishStructuredSections(rawText, structured.sections, opts.template);
    const markdown = normalizeKnownAsr(sectionsToMarkdown(sections, opts.template));
    const durationSeconds = probe.durationSeconds;

    return {
      raw: rawText,
      clean: normalizeKnownAsr(structured.clean || rawText),
      language: structured.language,
      sections,
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
  const outputPath = resolveUserPath(cwd, opts.output);
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
