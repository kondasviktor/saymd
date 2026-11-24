import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { compileSpec, renderSpec, transcribeAudio } from '../src/index.js';
import { loadAudio } from '../src/providers/audio-input.js';
import { startGeminiMock } from './gemini-mock.js';

const SPEC = {
  language: 'en',
  clean: 'Add an export button for admins.',
  sections: {
    objective: 'Add a CSV export button to the billing page',
    instructions: ['Show it to admins only', 'Use Saint MD naming'],
    acceptanceCriteria: ['Admins can download a CSV'],
  },
};
const reply = (_m: string, prompt: string) => (prompt.includes('Reply {"ok":true}') ? '{"ok":true}' : JSON.stringify(SPEC));

/** Run fn with GEMINI_BASE_URL pointing at a fresh mock. */
async function withGemini<T>(transcript: string, fn: (mock: Awaited<ReturnType<typeof startGeminiMock>>) => Promise<T>) {
  const mock = await startGeminiMock({ transcript, reply });
  const saved = process.env.GEMINI_BASE_URL;
  process.env.GEMINI_BASE_URL = mock.url;
  try {
    return await fn(mock);
  } finally {
    if (saved === undefined) delete process.env.GEMINI_BASE_URL;
    else process.env.GEMINI_BASE_URL = saved;
    await mock.close();
  }
}

test('loadAudio takes bytes (cloud) or a path (CLI)', async () => {
  const a = await loadAudio({ data: new Uint8Array([1, 2, 3]), filename: 'note.ogg', mimeType: 'audio/ogg' });
  assert.deepEqual([...a.buffer], [1, 2, 3]);
  assert.equal(a.filename, 'note.ogg');
  await assert.rejects(loadAudio({ mimeType: 'audio/ogg' }), /pass localPath or data/);
});

test('transcribeAudio: a Telegram-style voice note as bytes, on Groq', async () => {
  const original = globalThis.fetch;
  let form: FormData | undefined;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    form = init?.body as FormData;
    return new Response(JSON.stringify({ text: 'Ship the Saint MD export.' }));
  }) as typeof fetch;
  try {
    const t = await transcribeAudio({
      provider: 'groq',
      apiKey: 'gsk_test',
      audio: { data: new Uint8Array([79, 103, 103, 83]), filename: 'voice.ogg', mimeType: 'audio/ogg' },
      durationSeconds: 30,
    });
    assert.equal(t.raw, 'Ship the saymd export.', 'ASR fix applied');
    assert.equal(t.model, 'whisper-large-v3-turbo');
    assert.ok((t.estimatedCostUsd ?? 0) > 0);
    const file = form?.get('file') as File;
    assert.equal(file.name, 'voice.ogg');
    assert.equal(file.type, 'audio/ogg');
    assert.equal(file.size, 4);
  } finally {
    globalThis.fetch = original;
  }
});

test('transcribeAudio + compileSpec on Gemini: bytes upload, Interactions, Flash-Lite', async () => {
  await withGemini('Add a CSV export button for admins.', async (mock) => {
    const t = await transcribeAudio({
      provider: 'gemini',
      apiKey: 'AIza-mock',
      audio: { data: new Uint8Array(1234), filename: 'voice.ogg', mimeType: 'audio/ogg' },
      lang: 'en',
    });
    assert.equal(t.raw, 'Add a CSV export button for admins.');
    const start = mock.requests.find((q) => q.path === '/upload/v1beta/files')?.json as { file: { mimeType: string; displayName: string } };
    assert.deepEqual(start.file, { mimeType: 'audio/ogg', displayName: 'voice.ogg', sizeBytes: '1234' } as never);

    const spec = await compileSpec({ sttProvider: 'gemini', keys: { gemini: 'AIza-mock' }, raw: t.raw, template: 'feature' });
    assert.equal(spec.language, 'en');
    assert.match(spec.markdown, /## Objective\n\nAdd a CSV export button to the billing page/);
    assert.match(spec.markdown, /- Use saymd naming/, 'polish fixes ASR names in sections');
    assert.match(spec.markdown, /- \[ \] Admins can download a CSV/);
    assert.equal(spec.markdown, renderSpec(spec.sections, 'feature'));
  });
});

test('the CLI writes byte-identical Markdown to @saymd/core for the same input', { skip: spawnSync('ffmpeg', ['-version']).status !== 0 && 'ffmpeg not installed' }, async () => {
  const transcript = 'Add a CSV export button for admins.';
  const coreSpec = await withGemini(transcript, async () =>
    compileSpec({ sttProvider: 'gemini', keys: { gemini: 'AIza-mock' }, raw: transcript, template: 'feature' })
  );

  const work = await mkdtemp(join(tmpdir(), 'saymd-parity-'));
  try {
    const wav = join(work, 'a.wav');
    spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=2', wav], { stdio: 'ignore' });
    const cli = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'cli', 'src', 'cli.ts');
    const out = await withGemini(transcript, (mock) => new Promise<string>((resolve) => {
      const child = spawn(process.execPath, ['--import', import.meta.resolve('tsx'), cli, '--provider', 'gemini', '--file', wav, '--template', 'feature', '--stdout'], {
        cwd: work,
        env: { PATH: process.env.PATH, HOME: work, GEMINI_API_KEY: 'AIza-mock', GEMINI_BASE_URL: mock.url, NO_PROXY: '127.0.0.1' },
      });
      let stdout = '';
      child.stdout.on('data', (c) => (stdout += c));
      child.on('close', () => resolve(stdout));
    }));
    assert.equal(out.trimEnd(), coreSpec.markdown.trimEnd());
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
