import { writeFile, copyFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';

import { cleanupAudio, normalizeAudio, recordMic, splitLongAudio } from './audio.js';
import {
  compileSpec,
  createJsonLlm,
  estimateCostUsd,
  freeCompilerRules,
  getProvider,
  isKnownModel,
  normalizeKnownAsr,
  polishStructuredSections,
  polishTaskSections,
  providerLabel,
  renderSpec,
  resolveSttModel,
  type SttProviderId,
} from '@saymd/core';
import {
  loadVocab,
  resolveSttApiKey,
  loadConfig,
  providerKeys,
  resolveProvider,
  resolveTextApiKey,
  sttKeyEnvName,
} from './config.js';
import { resolveUserPath } from './paths.js';
import type { CliOptions, PathSummary, SaymdResult, SaymdSections, SplitTask } from './types.js';
import {
  FREE_MAX_SECONDS,
  PRO_MAX_MIC_SECONDS,
  PRO_UPGRADE_URL,
  getProCompilerAddendum,
  getProRecordingLimits,
  requireProModule,
} from './pro-gate.js';
import { importProModule } from './pro-install.js';

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
  const sttModel = resolveSttModel(providerId, config.models, opts.model);
  if (!isKnownModel(providerId, sttModel)) {
    process.stderr.write(
      `Note: ${sttModel} isn't a model saymd knows for ${providerLabel(providerId)} — trying it anyway; cost estimate uses the default rate.\n`
    );
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
  let proAddendum = isPro ? await getProCompilerAddendum({ vocab, outLang }) : '';

  // --ground: build the repo map before recording so a problem shows up before you speak.
  let ground: Awaited<ReturnType<typeof prepareGround>> | undefined;
  if (opts.ground) {
    ground = await prepareGround(cwd);
    proAddendum = [proAddendum, ground.addendum].filter(Boolean).join('\n\n');
  }
  if (opts.split) {
    await requireProModule('split', 'splitTasks', 'writeTaskFiles', 'planTaskFiles');
  }
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

    // Pro vocabulary also biases recognition where the provider supports it.
    const sttVocab = isPro ? vocab : [];
    process.stderr.write(`Transcribing via ${providerLabel(providerId)} (${sttModel})…\n`);
    const transcript =
      chunkPaths.length > 1
        ? await provider.chunkAndTranscribe(sttApiKey, chunkPaths, probe.mimeType, lang, sttModel, sttVocab)
        : await provider.transcribeFile(sttApiKey, {
            localPath: probe.localPath,
            mimeType: probe.mimeType,
            lang,
            durationSeconds: probe.durationSeconds,
            model: sttModel,
            vocabulary: sttVocab,
          });

    const rawText = normalizeKnownAsr(transcript.text);
    const base = {
      raw: rawText,
      durationSeconds: probe.durationSeconds,
      estimatedCostUsd: estimateCostUsd(providerId, probe.durationSeconds, transcript.model, chunkPaths.length),
      provider: providerId,
      sttModel: transcript.model,
    };

    if (opts.split) {
      const pro = await requireProModule('split', 'splitTasks');
      const { llm } = createJsonLlm(providerId, providerKeys(config));
      process.stderr.write('Splitting into tasks…\n');
      const split = await pro.splitTasks({
        llm,
        raw: rawText,
        rules: [proAddendum, freeCompilerRules()].filter(Boolean).join('\n\n'),
      });
      const language = outLang && outLang !== 'same' ? outLang : split.language;
      const tasks: SplitTask[] = [];
      const paths: PathSummary = { found: [], newFiles: [], missing: [] };
      for (const t of split.tasks) {
        let sections = polishTaskSections(t.sections as SaymdSections);
        if (ground) sections = await ground.check(sections, language, paths);
        tasks.push({ slug: t.slug, title: normalizeKnownAsr(t.title), depends_on: t.depends_on, sections });
      }
      return {
        ...base,
        clean: rawText,
        language,
        sections: {},
        markdown: tasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n') + '\n',
        tasks,
        summary: split.summary,
        paths: ground ? dedupePaths(paths) : undefined,
      };
    }

    process.stderr.write('Structuring into markdown…\n');
    // Same structuring as Pro Cloud: @saymd/core compileSpec.
    const structured = await compileSpec({
      sttProvider: providerId,
      keys: providerKeys(config),
      raw: rawText,
      template: opts.template,
      addendum: proAddendum,
    });
    let sections: SaymdSections = structured.sections;

    if (isPro && outLang && outLang !== 'same') {
      const textKey = resolveTextApiKey(config);
      const pro = await importProModule();
      if (textKey && pro?.translateSections) {
        process.stderr.write(`Translating spec to ${outLang}…\n`);
        sections = (await pro.translateSections({
          apiKey: textKey,
          sections,
          outLang,
          template: opts.template,
        })) as SaymdSections;
        sections = polishStructuredSections(rawText, sections, opts.template);
      }
    }

    const language = outLang && outLang !== 'same' ? outLang : structured.language;
    let paths: PathSummary | undefined;
    if (ground) {
      paths = { found: [], newFiles: [], missing: [] };
      sections = await ground.check(sections, language, paths);
    }
    const markdown = renderSpec(sections, opts.template);

    return {
      ...base,
      clean: structured.clean,
      language,
      sections,
      markdown,
      paths,
    };
  } finally {
    if (!opts.file) {
      // keep temp on failure — caller handles; success path cleans below
    }
    void chunkTemp;
  }
}

/** Build the repo map and a checker that flags @paths missing on disk. */
async function prepareGround(cwd: string) {
  const pro = await requireProModule(
    'ground',
    'buildRepoMap',
    'formatRepoMap',
    'groundAddendum',
    'checkPaths',
    'flagPaths'
  );
  const map = await pro.buildRepoMap(cwd);
  process.stderr.write(
    `Grounding in repo map: ${map.files.length} files${map.truncated ? ' (truncated)' : ''}` +
      `${prismaModels(map.schemas.prisma)}…\n`
  );
  return {
    map,
    addendum: pro.groundAddendum(pro.formatRepoMap(map)),
    async check(sections: SaymdSections, language: string, acc: PathSummary): Promise<SaymdSections> {
      const result = await pro.checkPaths(sections as Record<string, unknown>, map.root, map);
      acc.found.push(...result.found);
      acc.newFiles.push(...result.newFiles);
      acc.missing.push(...result.missing);
      return pro.flagPaths(sections as Record<string, unknown>, result, language) as SaymdSections;
    },
  };
}

function prismaModels(entries: string[]): string {
  const n = entries.filter((e) => e.startsWith('model ')).length;
  return n ? `, ${n} Prisma model${n === 1 ? '' : 's'}` : '';
}

function dedupePaths(p: PathSummary): PathSummary {
  return { found: [...new Set(p.found)], newFiles: [...new Set(p.newFiles)], missing: [...new Set(p.missing)] };
}

/** One stderr line for --ground. */
export function printPathLine(paths: PathSummary | undefined): void {
  if (!paths) return;
  const parts = [`${paths.found.length} found`, `${paths.newFiles.length} new`, `${paths.missing.length} missing`];
  console.error(`@paths checked against disk: ${parts.join(', ')}`);
  for (const p of paths.missing) console.error(`  ✗ @${p} — not found; flagged in Open questions`);
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
