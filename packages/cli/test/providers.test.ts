import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveCompilerProvider } from '../src/compiler/index.js';
import { estimateCostUsd, getProvider, listProviders } from '../src/providers/index.js';
import { createMockProvider } from '../src/providers/mock.js';

test('listProviders includes all four STT providers', () => {
  const ids = listProviders().map((p) => p.id);
  assert.deepEqual(ids, ['gemini', 'openai', 'deepgram', 'elevenlabs']);
});

test('estimateCostUsd scales by provider rate', () => {
  const seconds = 120;
  const gemini = estimateCostUsd('gemini', seconds);
  const deepgram = estimateCostUsd('deepgram', seconds);
  const openai = estimateCostUsd('openai', seconds);
  assert.ok(gemini > 0);
  assert.ok(deepgram > gemini);
  assert.ok(openai >= gemini);
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

test('resolveCompilerProvider matches STT provider when gemini/openai', () => {
  assert.equal(resolveCompilerProvider('gemini', {}), 'gemini');
  assert.equal(resolveCompilerProvider('openai', {}), 'openai');
});

test('resolveCompilerProvider prefers gemini for STT-only providers', () => {
  assert.equal(
    resolveCompilerProvider('deepgram', { geminiApiKey: 'g', deepgramApiKey: 'd' }),
    'gemini'
  );
  assert.equal(
    resolveCompilerProvider('elevenlabs', { openaiApiKey: 'o', elevenlabsApiKey: 'e' }),
    'openai'
  );
});

test('getProvider returns model names', () => {
  assert.match(getProvider('gemini').model, /gemini/);
  assert.equal(getProvider('openai').model, 'gpt-4o-transcribe');
  assert.equal(getProvider('deepgram').model, 'nova-3');
  assert.equal(getProvider('elevenlabs').model, 'scribe_v2');
});
