import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { getCompiler, resolveCompilerProvider } from '../src/compiler/index.js';
import {
  estimateCostUsd,
  getProvider,
  isKnownModel,
  listProviders,
  resolveSttModel,
  usdPerMinuteFor,
} from '../src/providers/index.js';
import { createMockProvider } from '../src/providers/mock.js';
import { RECOMMENDED_PROVIDER } from '../src/providers/types.js';

const MODEL_ENV = [
  'GROQ_TRANSCRIBE_MODEL',
  'GEMINI_TRANSCRIBE_MODEL',
  'OPENAI_TRANSCRIBE_MODEL',
  'DEEPGRAM_TRANSCRIBE_MODEL',
  'ELEVENLABS_TRANSCRIBE_MODEL',
  'GROQ_STRUCTURE_MODEL',
  'GROQ_BASE_URL',
  'OPENAI_BASE_URL',
  'GROQ_API_KEY',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
];

/** Run fn with model/base-url/key env vars cleared, restoring them after. */
async function withCleanEnv<T>(fn: () => Promise<T> | T): Promise<T> {
  const saved = Object.fromEntries(MODEL_ENV.map((k) => [k, process.env[k]]));
  for (const k of MODEL_ENV) delete process.env[k];
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

interface Captured {
  url: string;
  init?: RequestInit;
}

/** Replace global fetch with a stub returning `body` as JSON; returns captured calls. */
function stubFetch(body: unknown): { calls: Captured[]; restore: () => void } {
  const original = globalThis.fetch;
  const calls: Captured[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

async function tempAudio(): Promise<{ path: string; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'saymd-test-'));
  const path = join(dir, 'clip.wav');
  await writeFile(path, Buffer.from('RIFF0000WAVE'));
  return { path, dir };
}

test('listProviders includes all six STT providers, Groq first, OpenRouter last', () => {
  const ids = listProviders().map((p) => p.id);
  assert.deepEqual(ids, ['groq', 'gemini', 'openai', 'deepgram', 'elevenlabs', 'openrouter']);
  assert.equal(RECOMMENDED_PROVIDER, 'groq');
});

test('estimateCostUsd scales by provider rate', () => {
  const seconds = 120;
  const groq = estimateCostUsd('groq', seconds);
  const gemini = estimateCostUsd('gemini', seconds);
  const deepgram = estimateCostUsd('deepgram', seconds);
  const openai = estimateCostUsd('openai', seconds);
  assert.ok(groq > 0);
  assert.ok(gemini > groq);
  assert.ok(deepgram < gemini);
  assert.ok(openai >= gemini);
});

test('estimateCostUsd uses the model price: gpt-4o-mini-transcribe is half', () => {
  const full = estimateCostUsd('openai', 600, 'gpt-4o-transcribe');
  const mini = estimateCostUsd('openai', 600, 'gpt-4o-mini-transcribe');
  assert.ok(Math.abs(mini - full / 2) < 1e-9);
  assert.equal(usdPerMinuteFor('openai', 'gpt-4o-mini-transcribe'), 0.003);
  // Unknown model falls back to the default rate.
  assert.equal(usdPerMinuteFor('openai', 'some-proxy-model'), usdPerMinuteFor('openai'));
});

test('estimateCostUsd applies Groq 10 s minimum per request', () => {
  const oneShort = estimateCostUsd('groq', 3, 'whisper-large-v3-turbo', 1);
  const tenSeconds = estimateCostUsd('groq', 10, 'whisper-large-v3-turbo', 1);
  assert.equal(oneShort, tenSeconds);
});

test('mock provider returns transcript without network', async () => {
  const mock = createMockProvider('hello world');
  const result = await mock.transcribeFile('fake-key', {
    localPath: '/tmp/x.m4a',
    mimeType: 'audio/mp4',
    durationSeconds: 30,
  });
  assert.equal(result.text, 'hello world');
  assert.equal(result.provider, 'gemini');
  assert.equal(result.model, 'mock-transcribe');
});

test('resolveCompilerProvider matches STT provider when it has an LLM', () => {
  assert.equal(resolveCompilerProvider('gemini', {}), 'gemini');
  assert.equal(resolveCompilerProvider('openai', {}), 'openai');
  assert.equal(resolveCompilerProvider('groq', {}), 'groq');
});

test('resolveCompilerProvider prefers gemini, then openai, then groq for STT-only providers', async () => {
  await withCleanEnv(() => {
    assert.equal(
      resolveCompilerProvider('deepgram', { gemini: 'g', groq: 'q', deepgram: 'd' }),
      'gemini'
    );
    assert.equal(
      resolveCompilerProvider('elevenlabs', { openai: 'o', groq: 'q', elevenlabs: 'e' }),
      'openai'
    );
    assert.equal(resolveCompilerProvider('elevenlabs', { groq: 'q', elevenlabs: 'e' }), 'groq');
    assert.throws(() => resolveCompilerProvider('deepgram', { deepgram: 'd' }), /Groq/);
  });
});

test('getProvider returns default model names', async () => {
  await withCleanEnv(() => {
    assert.equal(getProvider('groq').model, 'whisper-large-v3-turbo');
    assert.match(getProvider('gemini').model, /gemini/);
    assert.equal(getProvider('openai').model, 'gpt-4o-transcribe');
    assert.equal(getProvider('deepgram').model, 'nova-3');
    assert.equal(getProvider('elevenlabs').model, 'scribe_v3');
  });
});

test('resolveSttModel precedence: --model > env > config > default', async () => {
  await withCleanEnv(() => {
    assert.equal(resolveSttModel('openai'), 'gpt-4o-transcribe');
    assert.equal(resolveSttModel('openai', { openai: 'whisper-1' }), 'whisper-1');
    // Config for another provider does not leak.
    assert.equal(resolveSttModel('openai', { groq: 'whisper-large-v3' }), 'gpt-4o-transcribe');
    process.env.OPENAI_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';
    assert.equal(resolveSttModel('openai', { openai: 'whisper-1' }), 'gpt-4o-mini-transcribe');
    assert.equal(resolveSttModel('openai', { openai: 'whisper-1' }, 'gpt-4o-transcribe'), 'gpt-4o-transcribe');
  });
});

test('isKnownModel lists the half-price OpenAI mini model', () => {
  assert.ok(isKnownModel('openai', 'gpt-4o-mini-transcribe'));
  assert.ok(isKnownModel('elevenlabs', 'scribe_v3'));
  assert.ok(!isKnownModel('openai', 'made-up-model'));
});

test('OpenAI transcribeFile sends the --model override', async () => {
  await withCleanEnv(async () => {
    const audio = await tempAudio();
    const stub = stubFetch({ text: 'hello', language: 'en' });
    try {
      const t = await getProvider('openai').transcribeFile('sk-test', {
        localPath: audio.path,
        mimeType: 'audio/wav',
        model: 'gpt-4o-mini-transcribe',
      });
      assert.equal(t.model, 'gpt-4o-mini-transcribe');
      assert.equal(stub.calls[0].url, 'https://api.openai.com/v1/audio/transcriptions');
      const form = stub.calls[0].init?.body as FormData;
      assert.equal(form.get('model'), 'gpt-4o-mini-transcribe');
    } finally {
      stub.restore();
      await rm(audio.dir, { recursive: true, force: true });
    }
  });
});

test('Groq transcribeFile calls the OpenAI-compatible Groq endpoint with whisper-large-v3-turbo', async () => {
  await withCleanEnv(async () => {
    const audio = await tempAudio();
    const stub = stubFetch({ text: 'szia világ' });
    try {
      const t = await getProvider('groq').transcribeFile('gsk_test', {
        localPath: audio.path,
        mimeType: 'audio/wav',
        lang: 'hu',
      });
      assert.equal(t.text, 'szia világ');
      assert.equal(t.provider, 'groq');
      assert.equal(t.model, 'whisper-large-v3-turbo');
      assert.equal(stub.calls[0].url, 'https://api.groq.com/openai/v1/audio/transcriptions');
      const headers = stub.calls[0].init?.headers as Record<string, string>;
      assert.equal(headers.Authorization, 'Bearer gsk_test');
      const form = stub.calls[0].init?.body as FormData;
      assert.equal(form.get('model'), 'whisper-large-v3-turbo');
      assert.equal(form.get('language'), 'hu');
    } finally {
      stub.restore();
      await rm(audio.dir, { recursive: true, force: true });
    }
  });
});

test('ElevenLabs transcribeFile sends scribe_v3 by default', async () => {
  await withCleanEnv(async () => {
    const audio = await tempAudio();
    const stub = stubFetch({ text: 'hello', language_code: 'en' });
    try {
      const t = await getProvider('elevenlabs').transcribeFile('xi-test', {
        localPath: audio.path,
        mimeType: 'audio/wav',
      });
      assert.equal(t.model, 'scribe_v3');
      const form = stub.calls[0].init?.body as FormData;
      assert.equal(form.get('model_id'), 'scribe_v3');
    } finally {
      stub.restore();
      await rm(audio.dir, { recursive: true, force: true });
    }
  });
});

test('Groq compiler structures via chat/completions with gpt-oss and JSON mode', async () => {
  await withCleanEnv(async () => {
    const content = JSON.stringify({
      language: 'en',
      clean: 'Add a login page.',
      sections: { objective: 'Add a login page', instructions: ['Create /login'] },
    });
    const stub = stubFetch({ choices: [{ message: { content } }] });
    try {
      const result = await getCompiler('groq').structureTranscript({
        apiKey: 'gsk_test',
        raw: 'add a login page',
        template: 'feature',
      });
      assert.equal(result.language, 'en');
      assert.equal(result.sections.objective, 'Add a login page');
      assert.deepEqual(result.sections.instructions, ['Create /login']);
      assert.equal(stub.calls[0].url, 'https://api.groq.com/openai/v1/chat/completions');
      const body = JSON.parse(String(stub.calls[0].init?.body));
      assert.equal(body.model, 'openai/gpt-oss-120b');
      assert.equal(body.reasoning_effort, 'low');
      assert.deepEqual(body.response_format, { type: 'json_object' });
    } finally {
      stub.restore();
    }
  });
});

test('OpenAI compiler keeps gpt-4o-mini and sends no reasoning_effort', async () => {
  await withCleanEnv(async () => {
    const content = JSON.stringify({ language: 'en', clean: 'x', sections: { objective: 'x' } });
    const stub = stubFetch({ choices: [{ message: { content } }] });
    try {
      await getCompiler('openai').structureTranscript({ apiKey: 'sk', raw: 'x', template: 'default' });
      assert.equal(stub.calls[0].url, 'https://api.openai.com/v1/chat/completions');
      const body = JSON.parse(String(stub.calls[0].init?.body));
      assert.equal(body.model, 'gpt-4o-mini');
      assert.equal(body.reasoning_effort, undefined);
    } finally {
      stub.restore();
    }
  });
});
