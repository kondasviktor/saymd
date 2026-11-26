import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createJsonLlm, polishTaskSections } from '@saymd/core';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.ts');

test('createJsonLlm uses the structuring provider and key (Groq, JSON mode)', async () => {
  const saved = { k: process.env.GROQ_API_KEY, u: process.env.GROQ_BASE_URL, m: process.env.GROQ_STRUCTURE_MODEL };
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_BASE_URL;
  delete process.env.GROQ_STRUCTURE_MODEL;
  const original = globalThis.fetch;
  let seen: { url: string; body: Record<string, unknown>; auth: string } | undefined;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    seen = {
      url: String(url),
      body: JSON.parse(String(init?.body)),
      auth: (init?.headers as Record<string, string>).Authorization,
    };
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"tasks":[]}' } }] }));
  }) as typeof fetch;
  try {
    const { provider, llm } = createJsonLlm('groq', { groq: 'gsk_cfg' });
    assert.equal(provider, 'groq');
    assert.equal(await llm('split this'), '{"tasks":[]}');
    assert.equal(seen?.url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(seen?.auth, 'Bearer gsk_cfg');
    assert.equal(seen?.body.model, 'openai/gpt-oss-120b');
    assert.deepEqual(seen?.body.response_format, { type: 'json_object' });
  } finally {
    globalThis.fetch = original;
    if (saved.k !== undefined) process.env.GROQ_API_KEY = saved.k;
    if (saved.u !== undefined) process.env.GROQ_BASE_URL = saved.u;
    if (saved.m !== undefined) process.env.GROQ_STRUCTURE_MODEL = saved.m;
  }
});

test('createJsonLlm needs a structuring key for STT-only providers', () => {
  const saved = [process.env.GEMINI_API_KEY, process.env.OPENAI_API_KEY, process.env.GROQ_API_KEY];
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    assert.throws(() => createJsonLlm('deepgram', { deepgram: 'd' }), /STT-only/);
  } finally {
    const names = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY'];
    saved.forEach((v, i) => v !== undefined && (process.env[names[i]] = v));
  }
});

test('polishTaskSections fixes ASR spellings without pulling in transcript context', () => {
  const out = polishTaskSections({ objective: 'Ship Saint Pro split', instructions: ['Use Saint MD'] });
  assert.doesNotMatch(JSON.stringify(out), /Saint/);
  assert.equal(out.context, undefined);
});

test('--help lists the Pro --split and --ground flags', () => {
  const r = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), CLI, '--help'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--split \[dir\]/);
  assert.match(r.stdout, /--ground/);
});

test('mcpConfig pins the exact CLI version for every agent', async () => {
  const { mcpConfig, MCP_CLIENTS, cliVersion } = await import('../src/mcp-config.js');
  assert.match(cliVersion(), /^\d+\.\d+\.\d+$/);
  assert.match(mcpConfig('claude', '9.9.9'), /claude mcp add --scope project saymd -- npx -y saymd@9\.9\.9 mcp/);
  const cursor = JSON.parse(mcpConfig('cursor', '9.9.9').split('\n').slice(1).join('\n'));
  assert.deepEqual(cursor, { mcpServers: { saymd: { command: 'npx', args: ['-y', 'saymd@9.9.9', 'mcp'] } } });
  assert.match(mcpConfig('codex', '9.9.9'), /\[mcp_servers\.saymd\]\ncommand = "npx"\nargs = \["-y","saymd@9\.9\.9","mcp"\]/);
  const vscode = JSON.parse(mcpConfig('vscode', '9.9.9').split('\n').slice(1).join('\n'));
  assert.equal(vscode.servers.saymd.type, 'stdio');
  assert.deepEqual([...MCP_CLIENTS], ['claude', 'cursor', 'codex', 'antigravity', 'vscode']);
  const agy = JSON.parse(mcpConfig('antigravity', '9.9.9').split('\n').slice(2).join('\n'));
  assert.deepEqual(agy, { mcpServers: { saymd: { command: 'npx', args: ['-y', 'saymd@9.9.9', 'mcp'] } } });
  assert.match(mcpConfig('antigravity', '9.9.9'), /\.agents\/mcp_config\.json/);
});

test('saymd mcp without Pro exits 1 and keeps stdout empty', () => {
  const home = mkdtempSync(join(tmpdir(), 'saymd-free-'));
  try {
    const r = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), CLI, 'mcp'], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, HOME: home },
      input: '',
    });
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /saymd mcp is Pro/);
    const cfg = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), CLI, 'mcp', 'config', 'cursor'], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, HOME: home },
    });
    assert.equal(cfg.status, 0);
    assert.match(cfg.stdout, /\.cursor\/mcp\.json/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('saymd inbox sync and project add without Pro exit 1 before any network call', () => {
  const home = mkdtempSync(join(tmpdir(), 'saymd-free-'));
  try {
    for (const [args, msg] of [
      [['inbox', 'sync'], /saymd inbox sync is Pro/],
      [['project', 'add', '--map'], /saymd project add is Pro/],
    ] as const) {
      const r = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), CLI, ...args], {
        encoding: 'utf8',
        // An unreachable API: a request would fail with a different error.
        env: { PATH: process.env.PATH, HOME: home, SAYMD_API_URL: 'http://127.0.0.1:9' },
        input: '',
      });
      assert.equal(r.status, 1);
      assert.match(r.stderr, msg);
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('an unknown command fails with the command list instead of starting a recording; readme = help', () => {
  const home = mkdtempSync(join(tmpdir(), 'saymd-free-'));
  try {
    const run = (...args: string[]) =>
      spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), CLI, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: home }, input: '' });
    const typo = run('inbx', 'sync');
    assert.equal(typo.status, 1);
    assert.match(typo.stderr, /Unknown command: inbx/);
    assert.match(typo.stderr, /Commands: help, setup, doctor, config, activate, mcp, inbox, project/);
    const readme = run('readme');
    assert.equal(readme.status, 0);
    assert.match(readme.stdout, /voice inbox for your repo/);
    assert.match(readme.stdout, /Pro Cloud — no API key/);
    assert.equal(readme.stderr, '');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
