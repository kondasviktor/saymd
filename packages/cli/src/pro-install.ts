import { createWriteStream } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import { ensureSaymdDir, SAYMD_DIR } from './config.js';

const execFileAsync = promisify(execFile);

const PRO_DOWNLOAD_URL = process.env.SAYMD_PRO_DOWNLOAD_URL || 'https://saymd.app/api/pro-download';
export const PRO_PACKAGE_DIR = join(SAYMD_DIR, 'node_modules', '@saymd', 'pro');
export const PRO_META_PATH = join(SAYMD_DIR, 'pro-meta.json');

export interface ProMeta {
  version: string;
  installedAt: string;
}

export async function loadProMeta(): Promise<ProMeta | null> {
  try {
    return JSON.parse(await readFile(PRO_META_PATH, 'utf8')) as ProMeta;
  } catch {
    return null;
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Resolve home-vendored Pro entry path, if present. */
export async function resolveProEntryPath(): Promise<string | null> {
  const local = join(PRO_PACKAGE_DIR, 'dist', 'index.js');
  if (await pathExists(local)) return local;
  return null;
}

export async function importProModule(): Promise<typeof import('@saymd/pro') | null> {
  const entry = await resolveProEntryPath();
  if (entry) {
    try {
      return (await import(pathToFileURL(entry).href)) as typeof import('@saymd/pro');
    } catch {
      /* try bare specifier */
    }
  }
  try {
    return await import('@saymd/pro');
  } catch {
    return null;
  }
}

async function downloadProTarball(code: string, destFile: string): Promise<string | undefined> {
  const res = await fetch(PRO_DOWNLOAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim() }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Pro download failed (${res.status}).`);
  }
  if (!res.body) throw new Error('Empty Pro download body.');
  const version = res.headers.get('x-saymd-pro-version') || undefined;
  const nodeStream = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream);
  await pipeline(nodeStream, createWriteStream(destFile));
  return version;
}

/**
 * Download + npm-install @saymd/pro into ~/.saymd (requires activation code).
 */
export async function ensureProInstalled(opts: {
  code: string;
  version?: string;
  force?: boolean;
}): Promise<{ version: string; skipped: boolean }> {
  await ensureSaymdDir();
  const meta = await loadProMeta();
  const existing = await resolveProEntryPath();
  if (!opts.force && existing && opts.version && meta?.version === opts.version) {
    return { version: meta.version, skipped: true };
  }
  // npm link / node_modules already provides Pro — skip network unless forced.
  if (!opts.force) {
    try {
      await import('@saymd/pro');
      if (!existing) {
        return { version: meta?.version || 'linked', skipped: true };
      }
    } catch {
      /* need download */
    }
  }

  process.stderr.write('Downloading Pro…\n');
  const tmp = await mkdtemp(join(tmpdir(), 'saymd-pro-'));
  const tgz = join(tmp, 'saymd-pro.tgz');
  try {
    const versionHdr = await downloadProTarball(opts.code, tgz);
    const version = opts.version || versionHdr || '0.1.0';

    await mkdir(SAYMD_DIR, { recursive: true, mode: 0o700 });
    // Ensure a package.json exists so npm --prefix is happy
    const prefixPkg = join(SAYMD_DIR, 'package.json');
    if (!(await pathExists(prefixPkg))) {
      await writeFile(
        prefixPkg,
        JSON.stringify({ name: 'saymd-home', private: true }, null, 2) + '\n',
        { mode: 0o600 }
      );
    }

    await execFileAsync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['install', tgz, '--prefix', SAYMD_DIR, '--omit=dev', '--no-fund', '--no-audit'],
      { env: process.env }
    );

    if (!(await resolveProEntryPath())) {
      throw new Error('npm install did not produce ~/.saymd/node_modules/@saymd/pro.');
    }

    await writeFile(
      PRO_META_PATH,
      JSON.stringify({ version, installedAt: new Date().toISOString() } satisfies ProMeta, null, 2) +
        '\n',
      { mode: 0o600 }
    );
    process.stderr.write(`Pro ${version} installed under ~/.saymd.\n`);
    return { version, skipped: false };
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
}
