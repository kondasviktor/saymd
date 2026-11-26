/** OpenRouter: base64 JSON transcription with the exact model slug, the real cost from usage.cost, structuring via chat. */
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';

import { compileSpec, createJsonLlm, openrouterAudioFormat, transcribeAudio } from '../src/index.js';

function body(req: IncomingMessage): Promise<Record<string, any>> {
  return new Promise((r) => {
    const c: Buffer[] = [];
    req.on('data', (d) => c.push(d));
    req.on('end', () => r(JSON.parse(Buffer.concat(c).toString('utf8') || '{}')));
  });
}

test('OpenRouter: transcription request, actual cost, and structuring on the same key', async () => {
  const seen: Array<{ url: string; auth?: string; json: Record<string, any> }> = [];
  const server = createServer(async (req, res) => {
    const json = await body(req);
    seen.push({ url: req.url ?? '', auth: req.headers.authorization, json });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/v1/audio/transcriptions') {
      return res.end(JSON.stringify({ text: 'Add dark mode to the settings page.', usage: { seconds: 95, cost: 0.00812 } }));
    }
    if (req.url === '/api/v1/chat/completions') {
      const content = JSON.stringify({ language: 'en', clean: 'Add dark mode.', sections: { objective: 'Add dark mode to the settings page', instructions: ['Add a toggle'] } });
      return res.end(JSON.stringify({ choices: [{ message: { content } }] }));
    }
    res.statusCode = 404;
    res.end('{}');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  process.env.OPENROUTER_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  try {
    const t = await transcribeAudio({
      provider: 'openrouter',
      apiKey: 'sk-or-test',
      model: 'openai/gpt-4o-mini-transcribe',
      audio: { data: Buffer.from('OggS voice'), filename: 'voice.oga', mimeType: 'audio/ogg' },
      lang: 'hu',
      durationSeconds: 95,
    });
    assert.equal(t.raw, 'Add dark mode to the settings page.');
    assert.equal(t.model, 'openai/gpt-4o-mini-transcribe');
    assert.equal(t.estimatedCostUsd, 0.00812, 'the cost OpenRouter reports, not an estimate');
    const stt = seen[0];
    assert.equal(stt.auth, 'Bearer sk-or-test');
    assert.deepEqual({ ...stt.json, input_audio: { ...stt.json.input_audio, data: Buffer.from(stt.json.input_audio.data, 'base64').toString() } }, {
      model: 'openai/gpt-4o-mini-transcribe',
      input_audio: { data: 'OggS voice', format: 'ogg' },
      language: 'hu',
      provider: { data_collection: 'deny' },
    });

    const spec = await compileSpec({ sttProvider: 'openrouter', keys: { openrouter: 'sk-or-test' }, raw: t.raw, template: 'feature' });
    assert.match(spec.markdown, /Add dark mode to the settings page/);
    assert.equal(seen[1].json.model, 'google/gemini-3.1-flash-lite', 'default structurer');
    assert.deepEqual(seen[1].json.response_format, { type: 'json_object' });
    assert.deepEqual(seen[1].json.provider, { data_collection: 'deny' }, 'only providers that do not store or train on content');

    // Pro Cloud can pair any STT provider with OpenRouter structuring, and --split uses the same choice.
    const { provider } = createJsonLlm('elevenlabs', { elevenlabs: 'el', openrouter: 'sk-or-test' }, 'openrouter');
    assert.equal(provider, 'openrouter');
    assert.throws(() => createJsonLlm('gemini', { gemini: 'g' }, 'openrouter'), /OPENROUTER_API_KEY not set for structuring/);
  } finally {
    delete process.env.OPENROUTER_BASE_URL;
    server.close();
  }
});

test('openrouterAudioFormat: Telegram .oga and Opus are ogg; m4a, mp3, wav by extension or MIME', () => {
  assert.equal(openrouterAudioFormat('voice/file_7.oga', 'audio/ogg'), 'ogg');
  assert.equal(openrouterAudioFormat('note.opus', 'audio/opus'), 'ogg');
  assert.equal(openrouterAudioFormat('Walk memo.m4a', 'audio/mp4'), 'm4a');
  assert.equal(openrouterAudioFormat('audio', 'audio/mpeg'), 'mp3');
  assert.equal(openrouterAudioFormat('x', 'audio/x-wav'), 'wav');
});
