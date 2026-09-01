#!/usr/bin/env node
import { copyFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { mkdir } from 'node:fs/promises';

import { cleanupAudio } from './audio.js';
import { runDoctor } from './doctor.js';
import { printCostLine, runPipeline } from './pipeline.js';
import { activateLicense, requireCrossLang, runContinue, runReview } from './pro-gate.js';
import { runConfigSet, runSetup } from './setup.js';
import { isSttProviderId, loadConfig, resolveTextApiKey } from './config.js';
import type { CliOptions, TemplateId } from './types.js';

function parseArgs(argv: string[]): CliOptions & { command?: string; activateKey?: string; configKey?: string; configValue?: string } {
  const opts: CliOptions & { command?: string; activateKey?: string; configKey?: string; configValue?: string } = {
    template: 'default',
    output: '.ai/prompt.md',
    raw: false,
    stdout: false,
    clipboard: false,
    json: false,
    diff: false,
    dryRun: false,
    recordSeconds: 120,
  };

  const args = [...argv];
  if (args[0] && !args[0].startsWith('-')) {
    opts.command = args.shift();
    if (opts.command === 'activate' && args[0]) {
      opts.activateKey = args.shift();
    }
    if (opts.command === 'config' && args[0] === 'set') {
      args.shift();
      opts.configKey = args.shift();
      opts.configValue = args.shift();
    }
  }

  while (args.length) {
    const a = args.shift()!;
    switch (a) {
      case '--file':
        opts.file = args.shift();
        break;
      case '--provider': {
        const p = args.shift();
        if (!p || !isSttProviderId(p)) {
          console.error('Provider must be: gemini, openai, deepgram, or elevenlabs');
          process.exit(1);
        }
        opts.provider = p;
        break;
      }
      case '--template':
        opts.template = args.shift() as TemplateId;
        break;
      case '-o':
      case '--output':
        opts.output = args.shift() ?? opts.output;
        break;
      case '--lang':
        opts.lang = args.shift();
        break;
      case '--out':
        opts.outLang = args.shift();
        break;
      case '--raw':
        opts.raw = true;
        break;
      case '--stdout':
        opts.stdout = true;
        break;
      case '--clipboard':
        opts.clipboard = true;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--diff':
        opts.diff = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--continue':
        opts.continue = args[0]?.startsWith('-') ? opts.output : (args.shift() ?? opts.output);
        break;
      case '--review':
        opts.review = args[0]?.startsWith('-') ? opts.output : (args.shift() ?? opts.output);
        break;
      case '--seconds':
        opts.recordSeconds = Number(args.shift() ?? '120');
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${a}`);
        printHelp();
        process.exit(1);
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`saymd — Speak once. Get a prompt file any agent can @.

Usage:
  saymd [--file audio.m4a] [options]
  saymd setup
  saymd doctor
  saymd config set provider <gemini|openai|deepgram|elevenlabs>
  saymd activate <license-key>

Options:
  --provider gemini|openai|deepgram|elevenlabs
                                STT provider (default: gemini, or ~/.saymd/config.json)
  --template feature|bug|plan   Built-in spec shape (default: generic 4-section)
  -o, --output path             Output markdown (default: .ai/prompt.md)
  --lang CODE                   Input language hint (auto-detect if omitted)
  --out CODE                    Pro: cross-language output (e.g. en while speaking hu)
  --raw                         Print raw transcript only
  --stdout                      Print markdown to stdout
  --clipboard                   Copy markdown to clipboard (macOS pbcopy)
  --json                        Print SaymdResult JSON
  --diff                        Show raw vs cleaned diff
  --dry-run                     Print merge/write diff without saving
  --continue [file]             Pro: merge new speech into existing spec
  --review [file]               Pro: gap check on existing spec
  --seconds N                   Max mic recording seconds (default 120)

BYOK (Bring Your Own Key): you pay the STT provider on your account.
Providers: Gemini (recommended), OpenAI, Deepgram, ElevenLabs — all on Free.

Pro:  https://saymd.app
`);
}

async function copyClipboard(text: string): Promise<void> {
  const { spawn } = await import('node:child_process');
  if (process.platform === 'darwin') {
    await new Promise<void>((resolve, reject) => {
      const p = spawn('pbcopy');
      p.on('error', reject);
      p.on('close', (c) => (c === 0 ? resolve() : reject(new Error('pbcopy failed'))));
      p.stdin?.write(text);
      p.stdin?.end();
    });
    console.error('Copied to clipboard.');
  } else if (process.platform === 'linux' && (await import('./audio.js')).commandExists('xclip')) {
    await new Promise<void>((resolve, reject) => {
      const p = spawn('xclip', ['-selection', 'clipboard']);
      p.on('error', reject);
      p.on('close', (c) => (c === 0 ? resolve() : reject(new Error('xclip failed'))));
      p.stdin?.write(text);
      p.stdin?.end();
    });
    console.error('Copied to clipboard.');
  } else {
    console.error('Clipboard not supported on this platform — use --stdout.');
  }
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();

  if (parsed.command === 'setup') {
    await runSetup();
    return;
  }
  if (parsed.command === 'doctor') {
    process.exit(await runDoctor());
  }
  if (parsed.command === 'config') {
    if (!parsed.configKey || !parsed.configValue) {
      console.error('Usage: saymd config set provider <gemini|openai|deepgram|elevenlabs>');
      process.exit(1);
    }
    await runConfigSet(parsed.configKey, parsed.configValue);
    return;
  }
  if (parsed.command === 'activate') {
    if (!parsed.activateKey) {
      console.error('Usage: saymd activate <license-key>');
      process.exit(1);
    }
    await activateLicense(parsed.activateKey);
    return;
  }

  if (parsed.review) {
    const apiKey = resolveTextApiKey(await loadConfig());
    if (!apiKey) {
      console.error('GEMINI_API_KEY or OPENAI_API_KEY not set. Run: saymd setup');
      process.exit(1);
    }
    await runReview({ apiKey, targetPath: join(cwd, parsed.review), cwd });
    return;
  }

  if (parsed.continue) {
    const apiKey = resolveTextApiKey(await loadConfig());
    if (!apiKey) {
      console.error('GEMINI_API_KEY or OPENAI_API_KEY not set. Run: saymd setup');
      process.exit(1);
    }
    const target = join(cwd, parsed.continue);
    const fresh = await runPipeline({ ...parsed, continue: undefined }, cwd);
    const merged = await runContinue({
      apiKey,
      targetPath: target,
      dryRun: parsed.dryRun,
      cwd,
      newMarkdown: fresh.markdown,
      newSections: fresh.sections,
    });
    if (!merged) return;
    if (parsed.dryRun) {
      console.log(merged);
      return;
    }
    await copyFile(target, target + '.bak').catch(() => undefined);
    await writeFile(target, merged, 'utf8');
    printCostLine(fresh);
    console.log(`Updated ${parsed.continue}`);
    return;
  }

  await requireCrossLang(parsed.outLang);

  let tempPath: string | undefined;
  try {
    const result = await runPipeline(parsed, cwd);

    if (parsed.raw) {
      console.log(result.raw);
      printCostLine(result);
      return;
    }

    if (parsed.diff) {
      console.log('--- raw');
      console.log(result.raw);
      console.log('--- clean');
      console.log(result.clean);
    }

    const body = parsed.json ? JSON.stringify(result, null, 2) : result.markdown;

    if (parsed.stdout || parsed.json) {
      console.log(body);
    } else if (!parsed.dryRun) {
      const out = join(cwd, parsed.output);
      await mkdir(dirname(out), { recursive: true });
      await copyFile(out, out + '.bak').catch(() => undefined);
      await writeFile(out, result.markdown, 'utf8');
      console.log(`Wrote ${parsed.output} (${result.language})`);
    } else {
      console.log('[dry-run]', parsed.output);
      console.log(result.markdown);
    }

    if (parsed.clipboard) await copyClipboard(result.markdown);
    printCostLine(result);
  } catch (err) {
    if (tempPath) {
      console.error(`Audio kept for retry: ${tempPath}`);
      console.error(`Retry: saymd --file ${tempPath}`);
    }
    throw err;
  } finally {
    await cleanupAudio(undefined);
  }
}

main().catch((err) => {
  console.error((err as Error).message || err);
  process.exit(1);
});
