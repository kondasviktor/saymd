import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createJsonLlm } from '../src/compiler/index.js';
import { polishTaskSections } from '../src/structure-polish.js';

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
    const { provider, llm } = createJsonLlm('groq', { groqApiKey: 'gsk_cfg' });
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
    assert.throws(() => createJsonLlm('deepgram', { deepgramApiKey: 'd' }), /STT-only/);
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
