#!/usr/bin/env node
import { copyFile, writeFile, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';

import { cleanupAudio } from './audio.js';
import { describeError } from './errors.js';
import { runDoctor } from './doctor.js';
import { printCostLine, printPathLine, runPipeline } from './pipeline.js';
import {
  activateLicense,
  hasValidLicense,
  requireCrossLang,
  requirePro,
  requireProModule,
  runContinue,
  runReview,
} from './pro-gate.js';
import { importProModule } from './pro-install.js';
import { printHelp, printNextAfterSetup, printStartHere } from './help.js';
import { runInboxSync, runProjectAdd, runProjectRemove } from './cloud.js';
import { cliVersion, MCP_CLIENTS, printMcpConfig } from './mcp-config.js';
import { resolveUserPath } from './paths.js';
import { runConfigSet, runConfigShow, runSetup } from './setup.js';
import { isSttProviderId, loadConfig, resolveSttApiKey, resolveTextApiKey, resolveProvider, sttKeyEnvName } from './config.js';
import type { CliOptions, SaymdResult, TemplateId } from './types.js';

type ParsedArgs = CliOptions & {
  command?: string;
  activateKey?: string;
  configKey?: string;
  configValue?: string;
  /** `saymd mcp …` arguments, passed through untouched. */
  mcpArgs?: string[];
};

const COMMANDS = ['help', 'readme', 'setup', 'doctor', 'config', 'activate', 'mcp', 'inbox', 'project'];

function parseArgs(argv: string[]): ParsedArgs {
  const opts: ParsedArgs = {
    template: 'default',
    output: '.ai/prompt.md',
    raw: false,
    stdout: false,
    clipboard: false,
    json: false,
    diff: false,
    dryRun: false,
    ground: false,
    recordSeconds: 0,
  };

  const args = [...argv];
  if (args[0] && !args[0].startsWith('-')) {
    opts.command = args.shift()!;
    if (!COMMANDS.includes(opts.command)) {
      // Never fall through to recording on a typo (e.g. "saymd inbx sync").
      console.error(
        `Unknown command: ${opts.command}\nCommands: ${COMMANDS.filter((c) => c !== 'readme').join(', ')}\nStart here: saymd help · all options: saymd --help`
      );
      process.exit(1);
    }
    if (opts.command === 'activate' && args[0]) {
      opts.activateKey = args.shift();
    }
    if (opts.command === 'mcp' || opts.command === 'inbox' || opts.command === 'project') {
      opts.mcpArgs = args.splice(0);
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
          console.error('Provider must be: groq, gemini, openai, deepgram, or elevenlabs');
          process.exit(1);
        }
        opts.provider = p;
        break;
      }
      case '--model': {
        const m = args.shift();
        if (!m || m.startsWith('-')) {
          console.error('Usage: --model <model-id>  (e.g. --model gpt-4o-mini-transcribe)');
          process.exit(1);
        }
        opts.model = m;
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
      case '--split':
        opts.split = args[0] && !args[0].startsWith('-') ? args.shift()! : '.ai/tasks';
        break;
      case '--ground':
        opts.ground = true;
        break;
      case '--review':
        opts.review = args[0]?.startsWith('-') ? opts.output : (args.shift() ?? opts.output);
        break;
      case '--seconds':
        opts.recordSeconds = Number(args.shift() ?? '60');
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

/** Write (or preview) --split tasks and print what an agent should run first. */
async function writeSplit(
  result: SaymdResult,
  dirArg: string,
  cwd: string,
  opts: { dryRun: boolean; stdout: boolean; json: boolean }
): Promise<void> {
  const pro = await requireProModule('split', 'writeTaskFiles', 'planTaskFiles');
  const dir = resolveUserPath(cwd, dirArg);
  const drafts = (result.tasks ?? []).map((t) => ({ ...t, sections: t.sections as Record<string, unknown> }));
  const meta = {
    created: new Date().toISOString().slice(0, 10),
    source: 'voice',
    language: result.language,
  };

  if (opts.dryRun || opts.stdout || opts.json) {
    const plan = await pro.planTaskFiles(dir, drafts, meta);
    if (opts.json) {
      console.log(JSON.stringify({ ...result, files: plan.files.map((f) => ({ name: f.name, content: f.content })) }, null, 2));
    } else {
      if (opts.dryRun) console.log(`[dry-run] ${dirArg}`);
      for (const f of plan.files) console.log(`===== ${f.name}\n${f.content}`);
    }
  } else {
    const written = await pro.writeTaskFiles(dir, drafts, meta);
    const rel = dirArg.replace(/\/$/, '');
    console.log(`Wrote ${written.written.length} task${written.written.length === 1 ? '' : 's'} to ${rel}/ (${result.language})`);
    for (const t of written.written) {
      const deps = t.depends_on.length ? `  ← ${t.depends_on.join(', ')}` : '';
      console.log(`  ${t.file}  ${t.title}${deps}`);
    }
    console.log(`Index: ${rel}/README.md  ·  Start with: @${rel}/${written.written[0]?.file ?? 'README.md'}`);
  }
  printPathLine(result.paths);
  printCostLine(result);
}

/**
 * `saymd mcp`            serve this repo's voice inbox over stdio (Pro)
 * `saymd mcp config [c]` print agent settings (free)
 * `saymd mcp --check`    list what the server would serve, then exit (Pro)
 */
async function runMcp(args: string[], cwd: string): Promise<void> {
  if (args[0] === 'config') {
    printMcpConfig(args[1]);
    return;
  }
  const rootIdx = args.indexOf('--root');
  const root = rootIdx >= 0 ? resolveUserPath(cwd, args[rootIdx + 1] ?? '.') : undefined;
  const known = new Set(['--check', '--root', ...(rootIdx >= 0 ? [args[rootIdx + 1]] : [])]);
  const unknown = args.filter((a) => !known.has(a));
  if (unknown.length) {
    console.error(`Unknown argument: ${unknown[0]}\nUsage: saymd mcp [--root dir] [--check] | saymd mcp config [${MCP_CLIENTS.join('|')}]`);
    process.exit(1);
  }
  const pro = await requireProModule('mcp', 'startMcpServer', 'listTasks', 'listInbox', 'findRepoRoot');
  if (args.includes('--check')) {
    const repo = root ?? (await pro.findRepoRoot(cwd));
    const tasks = await pro.listTasks(repo);
    const inbox = await pro.listInbox(repo);
    console.log(`saymd mcp would serve ${repo}`);
    console.log(`  tasks: ${tasks.tasks.length} (${tasks.counts.done} done)${tasks.next ? ` · next: ${tasks.next}` : ''}`);
    console.log(`  inbox: ${inbox.length} item${inbox.length === 1 ? '' : 's'}`);
    console.log(`Settings for your agent: saymd mcp config`);
    return;
  }
  await pro.startMcpServer({ cwd, root, version: cliVersion() });
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();

  if (parsed.command === 'help' || parsed.command === 'readme') {
    printStartHere();
    return;
  }
  if (parsed.command === 'setup') {
    await runSetup();
    return;
  }
  if (parsed.command === 'doctor') {
    process.exit(await runDoctor());
  }
  if (parsed.command === 'config') {
    if (!parsed.configKey && !parsed.configValue) {
      await runConfigShow();
      return;
    }
    if (!parsed.configKey || !parsed.configValue) {
      console.error('Usage: saymd config\n       saymd config set provider <groq|gemini|openai|deepgram|elevenlabs>\n       saymd config set model <model-id|default>');
      process.exit(1);
    }
    await runConfigSet(parsed.configKey, parsed.configValue);
    return;
  }
  if (parsed.command === 'mcp') {
    await runMcp(parsed.mcpArgs ?? [], cwd);
    return;
  }
  if (parsed.command === 'inbox' || parsed.command === 'project') {
    const [sub, ...rest] = parsed.mcpArgs ?? [];
    if (parsed.command === 'inbox' && sub === 'sync') return runInboxSync(rest, cwd);
    if (parsed.command === 'project' && sub === 'add') return runProjectAdd(rest, cwd);
    if (parsed.command === 'project' && sub === 'remove') return runProjectRemove(rest, cwd);
    console.error(
      'Usage: saymd inbox sync [--dry-run] [--no-refresh]\n       saymd project add [--name <name>] [--map | --no-map]\n       saymd project remove [--name <name>]'
    );
    process.exit(1);
  }
  if (parsed.command === 'activate') {
    if (!parsed.activateKey) {
      console.error('Usage: saymd activate <activation-code>');
      process.exit(1);
    }
    await activateLicense(parsed.activateKey);
    return;
  }

  // No STT key yet → show start-here instead of a blank / cryptic failure.
  const config = await loadConfig();
  const providerId = resolveProvider(config, parsed.provider);
  if (!resolveSttApiKey(providerId, config) && !parsed.review) {
    printStartHere();
    console.error(`Missing ${sttKeyEnvName(providerId)} — run step 1 above.`);
    process.exit(1);
  }

  if (parsed.split && (parsed.continue || parsed.review)) {
    console.error('--split cannot be combined with --continue or --review.');
    process.exit(1);
  }

  if (parsed.review) {
    const apiKey = resolveTextApiKey(await loadConfig());
    if (!apiKey) {
      console.error('GEMINI_API_KEY or OPENAI_API_KEY not set. Run: saymd setup');
      process.exit(1);
    }
    await runReview({ apiKey, targetPath: resolveUserPath(cwd, parsed.review), cwd });
    return;
  }

  if (parsed.continue) {
    // Gate before any mic / STT work so free users never start recording.
    if (!(await requirePro('continue'))) return;
    const apiKey = resolveTextApiKey(await loadConfig());
    if (!apiKey) {
      console.error('GEMINI_API_KEY or OPENAI_API_KEY not set. Run: saymd setup');
      process.exit(1);
    }
    const target = resolveUserPath(cwd, parsed.continue);
    const existingMd = await readFile(target, 'utf8').catch(() => '');
    const proMod = await importProModule();
    const inferred =
      parsed.template !== 'default'
        ? parsed.template
        : proMod?.detectTemplate
          ? proMod.detectTemplate(existingMd)
          : 'default';
    const fresh = await runPipeline(
      { ...parsed, continue: undefined, template: inferred },
      cwd
    );
    const merged = await runContinue({
      apiKey,
      targetPath: target,
      dryRun: parsed.dryRun,
      cwd,
      newMarkdown: fresh.markdown,
      newSections: fresh.sections,
      template: inferred,
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

    if (parsed.split && result.tasks) {
      await writeSplit(result, parsed.split, cwd, parsed);
      return;
    }

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
      const out = resolveUserPath(cwd, parsed.output);
      await mkdir(dirname(out), { recursive: true });
      await copyFile(out, out + '.bak').catch(() => undefined);
      await writeFile(out, result.markdown, 'utf8');
      console.log(`Wrote ${parsed.output} (${result.language})`);
    } else {
      console.log('[dry-run]', parsed.output);
      console.log(result.markdown);
    }

    if (parsed.clipboard) await copyClipboard(result.markdown);
    printPathLine(result.paths);
    printCostLine(result);

    if (
      !parsed.stdout &&
      !parsed.json &&
      !parsed.raw &&
      !parsed.dryRun &&
      !(await hasValidLicense())
    ) {
      const lang = (result.language || '').toLowerCase();
      const notEnglish = lang && lang !== 'en' && lang !== 'eng' && lang !== 'und';
      console.error(`
Want to add more to this file?
  saymd --continue ${parsed.output}
${notEnglish ? `\nSpoke ${lang}? Pro can write the next spec in English:\n  saymd --out en --template ${parsed.template} -o ${parsed.output}\n` : ''}
--continue${notEnglish ? ' and --out' : ''} is Pro → https://saymd.app/pricing.html
`);
    }
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
  console.error(describeError(err));
  process.exit(1);
});
