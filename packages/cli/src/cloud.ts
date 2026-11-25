/**
 * Pro Cloud from the CLI:
 *   saymd project add [--name <name>] [--map | --no-map]   register this repo (optional repo map upload)
 *   saymd inbox sync [--dry-run] [--no-refresh]             pull Telegram specs into .ai/inbox/ or .ai/tasks/
 * Signs in with the license `saymd activate` saved (~/.saymd/license.json). SAYMD_API_URL overrides saymd.app.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { loadLicense } from './config.js';
import { requireProModule } from './pro-gate.js';

export const PROJECT_FILE = '.saymd/project.json';

interface ProjectFile {
  id: number;
  name: string;
  /** The user opted in to uploading the repo map; sync refreshes it. */
  map: boolean;
}

interface CloudItem {
  id: string;
  title: string;
  language?: string;
  template?: string;
  markdown: string;
  tasks: Array<{ slug: string; title: string; depends_on: string[]; sections: Record<string, unknown> }> | null;
  created: string;
  project: { id: number; name: string } | null;
}

export function apiBase(): string {
  return (process.env.SAYMD_API_URL?.trim() || 'https://saymd.app').replace(/\/$/, '');
}

async function licenseToken(): Promise<string> {
  const license = await loadLicense();
  if (!license?.key || !license.signature) {
    throw new Error('No saymd license on this machine. Run: saymd activate <activation-code>');
  }
  return `${license.key}.${license.signature}`;
}

async function cloudFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${await licenseToken()}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(data.error || `saymd.app answered ${res.status}`);
  return data;
}

async function readProjectFile(root: string): Promise<ProjectFile | null> {
  try {
    const p = JSON.parse(await readFile(join(root, PROJECT_FILE), 'utf8')) as ProjectFile;
    return Number.isInteger(p.id) && typeof p.name === 'string' ? p : null;
  } catch {
    return null;
  }
}

/** The repo map without the local folder path: that never leaves the machine. */
async function uploadableMap(root: string) {
  const pro = await requireProModule('project', 'buildRepoMap');
  const { root: _root, ...map } = await pro.buildRepoMap(root);
  return map;
}

async function askYesNo(question: string): Promise<boolean> {
  if (!stdin.isTTY) return false;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
}

function flagValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export async function runProjectAdd(args: string[], cwd: string): Promise<void> {
  const pro = await requireProModule('project', 'findRepoRoot', 'buildRepoMap');
  const root = await pro.findRepoRoot(cwd);
  const existing = await readProjectFile(root);
  const name = (flagValue(args, '--name') ?? existing?.name ?? basename(root)).trim();

  let withMap: boolean;
  if (args.includes('--map')) withMap = true;
  else if (args.includes('--no-map')) withMap = false;
  else if (existing) withMap = existing.map;
  else {
    withMap = await askYesNo(
      'Upload a repo map so Telegram specs reference real files?\n' +
        '  It holds file paths, package.json names, schema names and AGENTS.md/CLAUDE.md headings —\n' +
        '  never source code, never this folder\'s location. [y/N] '
    );
  }

  const map = withMap ? await uploadableMap(root) : undefined;
  const { project } = await cloudFetch<{ project: { id: number; name: string; hasMap: boolean } }>('/api/cloud-projects', {
    method: 'POST',
    body: { name, ...(map ? { map } : {}) },
  });
  await mkdir(join(root, '.saymd'), { recursive: true });
  await writeFile(join(root, PROJECT_FILE), JSON.stringify({ id: project.id, name: project.name, map: withMap } satisfies ProjectFile, null, 2) + '\n');

  console.log(`Project "${project.name}" registered with saymd Pro Cloud (${PROJECT_FILE}).`);
  console.log(
    map
      ? `Repo map uploaded: ${map.files.length} paths${map.truncated ? ' (truncated)' : ''}. It refreshes on every saymd inbox sync.`
      : 'No repo map uploaded (run saymd project add --map to ground specs in this repo).'
  );
  console.log('In Telegram, tap 📁 Project under a note to send it here, then run: saymd inbox sync');
}

export async function runInboxSync(args: string[], cwd: string): Promise<void> {
  const pro = await requireProModule('inbox', 'findRepoRoot', 'writeInboxItem', 'writeTaskFiles', 'readTasks');
  const root = await pro.findRepoRoot(cwd);
  const dryRun = args.includes('--dry-run');
  const project = await readProjectFile(root);

  if (project?.map && !args.includes('--no-refresh') && !dryRun) {
    await cloudFetch('/api/cloud-projects', { method: 'POST', body: { name: project.name, map: await uploadableMap(root) } });
  }

  const { items } = await cloudFetch<{ items: CloudItem[] }>(`/api/cloud-inbox${project ? `?project=${project.id}` : ''}`);
  if (!items.length) {
    console.log(`Inbox is empty${project ? ` for ${project.name}` : ''}. Send saymd a voice note on Telegram.`);
    return;
  }

  const tasksDir = join(root, '.ai', 'tasks');
  const done: string[] = [];
  for (const item of items) {
    const label = item.tasks?.length ? `${item.tasks.length} tasks` : 'spec';
    if (dryRun) {
      console.log(`[dry-run] ${item.title} — ${label}${item.project ? ` (${item.project.name})` : ''}`);
      continue;
    }
    if (item.tasks?.length) {
      const source = `telegram:${item.id}`;
      const already = (await pro.readTasks(tasksDir)).filter((t) => t.source === source);
      if (already.length) {
        console.log(`= ${item.title} — tasks already in .ai/tasks/ (${already.map((t) => t.file).join(', ')})`);
      } else {
        const written = await pro.writeTaskFiles(tasksDir, item.tasks, {
          created: item.created.slice(0, 10),
          source,
          language: item.language,
        });
        console.log(`↓ ${item.title} → ${written.written.map((t) => `.ai/tasks/${t.file}`).join(', ')}`);
      }
    } else {
      const out = await pro.writeInboxItem(root, {
        id: item.id,
        title: item.title,
        markdown: item.markdown,
        created: item.created,
        language: item.language,
        template: item.template,
      });
      console.log(`${out.written ? '↓' : '='} ${item.title} → ${out.path}`);
    }
    done.push(item.id);
  }

  if (dryRun) {
    console.log(`\n${items.length} item${items.length === 1 ? '' : 's'} waiting. Run without --dry-run to write them.`);
    return;
  }
  await cloudFetch('/api/cloud-inbox', { method: 'POST', body: { ack: done } });
  console.log(`\nSynced ${done.length} item${done.length === 1 ? '' : 's'}. @ them in your agent, or let it pull them with saymd mcp.`);
}
