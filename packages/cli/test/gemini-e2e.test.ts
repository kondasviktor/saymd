import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { isDedicatedTranscribeModel, transcribeVocabulary } from '@saymd/core';

import { startGeminiMock, type GeminiMock } from '../../core/test/gemini-mock.js';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.ts');
const TSX = import.meta.resolve('tsx');
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const skip = !hasFfmpeg && 'ffmpeg not installed';

const SPEC = {
  language: 'hu',
  clean: 'Kell egy export gomb a számlázó oldalra.',
  sections: {
    objective: 'Export gomb a számlázó oldalra',
    instructions: ['Adj hozzá egy CSV export gombot', 'Csak adminok lássák'],
  },
};

let mock: GeminiMock;
let work = '';
let audio = '';
let transcript = 'Kell egy export gomb a számlázó oldalra, csak adminoknak.';

function reply(_model: string, prompt: string): string {
  if (prompt.includes('Reply {"ok":true}')) return '{"ok":true}';
  if (prompt.includes('Transcribe this audio verbatim')) return 'General-model transcript about an export button.';
  return JSON.stringify(SPEC);
}

function run(args: string[], extraEnv: Record<string, string> = {}): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((r) => {
    const child = spawn(process.execPath, ['--import', TSX, CLI, ...args], {
      cwd: work,
      env: {
        PATH: process.env.PATH,
        HOME: join(work, 'home'),
        GEMINI_API_KEY: 'AIza-mock-key',
        GEMINI_BASE_URL: mock.url,
        NO_PROXY: '127.0.0.1',
        ...extraEnv,
      },
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (err += c));
    child.on('close', (code) => r({ code, out, err }));
  });
}

before(async () => {
  mock = await startGeminiMock({ transcript: () => transcript, reply });
  work = await mkdtemp(join(tmpdir(), 'saymd-gemini-'));
  audio = join(work, 'memo.wav');
  if (hasFfmpeg) spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=3', audio], { stdio: 'ignore' });
});

after(async () => {
  await mock?.close();
  if (work) await rm(work, { recursive: true, force: true });
});

test('isDedicatedTranscribeModel picks the Interactions API only for transcribe models', () => {
  assert.ok(isDedicatedTranscribeModel('gemini-3.5-transcribe'));
  assert.ok(isDedicatedTranscribeModel('models/gemini-3.5-transcribe'));
  assert.ok(!isDedicatedTranscribeModel('gemini-3.5-transcribe-live'));
  assert.ok(!isDedicatedTranscribeModel('gemini-3.5-flash-lite'));
});

test('transcribeVocabulary always biases towards saymd, dedupes and caps at 1000', () => {
  assert.deepEqual(transcribeVocabulary(), ['saymd']);
  assert.deepEqual(transcribeVocabulary(['Prisma', ' Prisma ', 'saymd', '']), ['saymd', 'Prisma']);
  assert.equal(transcribeVocabulary(Array.from({ length: 1200 }, (_, i) => `t${i}`)).length, 1000);
});

test('Free Gemini: Files API upload → Interactions transcribe → Flash-Lite JSON structuring', { skip }, async () => {
  mock.requests.length = 0;
  const r = await run(['--provider', 'gemini', '--file', audio, '--lang', 'hu', '--template', 'feature', '-o', '.ai/prompt.md']);
  assert.equal(r.code, 0, r.err);
  assert.match(r.err, /Transcribing via Google Gemini \(gemini-3\.5-transcribe\)/);
  assert.match(r.out, /Wrote \.ai\/prompt\.md \(hu\)/);

  const paths = mock.requests.map((q) => `${q.method} ${q.path}`);
  assert.deepEqual(paths, [
    'POST /upload/v1beta/files',
    'POST /upload-session/1',
    'POST /v1beta/interactions',
    'DELETE /v1beta/files/mock1',
    'POST /v1beta/models/gemini-3.5-flash-lite:generateContent',
  ]);
  for (const q of mock.requests) assert.equal(q.apiKey, 'AIza-mock-key');

  const interaction = mock.requests[2].json as {
    model: string;
    input: Array<{ type: string; uri: string; mime_type: string }>;
    generation_config: { transcription_config: { language_codes?: string[]; custom_vocabulary?: string[] } };
  };
  assert.equal(interaction.model, 'gemini-3.5-transcribe');
  assert.equal(interaction.input[0].type, 'audio');
  assert.match(interaction.input[0].uri, /\/v1beta\/files\/mock1$/);
  assert.equal(interaction.input[0].mime_type, 'audio/wav');
  assert.deepEqual(interaction.generation_config.transcription_config, {
    language_codes: ['hu'],
    custom_vocabulary: ['saymd'],
  });

  const structure = mock.requests[4].json as {
    contents: Array<{ parts: Array<{ text: string }> }>;
    generationConfig: { responseMimeType: string };
  };
  assert.equal(structure.generationConfig.responseMimeType, 'application/json');
  assert.match(structure.contents[0].parts[0].text, /Kell egy export gomb/);

  const md = await readFile(join(work, '.ai', 'prompt.md'), 'utf8');
  assert.match(md, /## Objective\n\nExport gomb a számlázó oldalra/);
  assert.match(md, /- Csak adminok lássák/);
});

test('--model with a general Gemini model uses the prompt-based generateContent path', { skip }, async () => {
  mock.requests.length = 0;
  const r = await run(['--provider', 'gemini', '--model', 'gemini-3.5-flash-lite', '--file', audio, '--raw']);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /General-model transcript/);
  assert.ok(!mock.requests.some((q) => q.path === '/v1beta/interactions'));
  const stt = mock.requests.find((q) => q.body.includes('Transcribe this audio verbatim'));
  assert.ok(stt, 'prompt-based transcription request sent');
  assert.equal(stt.path, '/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.match(stt.body, /"fileData":\{"fileUri":"[^"]+\/v1beta\/files\/mock\d+"/);
});

test('doctor verifies the Gemini key with Flash-Lite and reuses it for structuring', { skip }, async () => {
  mock.requests.length = 0;
  const r = await run(['doctor']);
  assert.match(r.out, /STT provider: Google Gemini \(gemini-3\.5-transcribe\)/);
  assert.match(r.out, /✓ GEMINI_API_KEY valid/);
  assert.match(r.out, /Prompt compiler: gemini \(same key as speech-to-text\)/);
  assert.ok(mock.requests.some((q) => q.path === '/v1beta/models/gemini-3.5-flash-lite:generateContent'));
});

test('an empty transcript from Gemini fails with a clear message', { skip }, async () => {
  const saved = transcript;
  transcript = '';
  try {
    const r = await run(['--provider', 'gemini', '--file', audio, '--stdout']);
    assert.equal(r.code, 1);
    assert.match(r.err, /Gemini returned no transcription text/);
  } finally {
    transcript = saved;
  }
});
