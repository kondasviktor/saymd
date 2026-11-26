import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer, type IncomingMessage } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.ts');
const TSX = import.meta.resolve('tsx');
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Full free path on Groq with no real network: ffmpeg-generated audio → CLI → mock Groq
 * (transcription + structuring) → .ai/prompt.md. One GROQ_API_KEY, no other key.
 */
test('saymd --provider groq --file writes a structured spec with one Groq key', { skip: !hasFfmpeg && 'ffmpeg not installed' }, async () => {
  const seen: Array<{ path: string; auth?: string; body: string }> = [];
  const server = createServer(async (req, res) => {
    const body = (await readBody(req)).toString('latin1');
    seen.push({ path: req.url ?? '', auth: req.headers.authorization, body });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/openai/v1/audio/transcriptions') {
      res.end(JSON.stringify({ text: 'Add a dark mode toggle to the settings page and remember the choice.' }));
    } else if (req.url === '/openai/v1/chat/completions') {
      const content = JSON.stringify({
        language: 'en',
        clean: 'Add a dark mode toggle to the settings page and remember the choice.',
        sections: {
          objective: 'Add a dark mode toggle to the settings page',
          context: 'Users want to switch themes.',
          instructions: ['Add a toggle on the settings page', 'Persist the choice'],
          constraints: ['Keep the current light theme as default'],
          acceptanceCriteria: ['Toggle switches theme', 'Choice survives reload'],
        },
      });
      res.end(JSON.stringify({ choices: [{ message: { content } }] }));
    } else {
      res.statusCode = 404;
      res.end('{}');
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as AddressInfo).port;

  const work = await mkdtemp(join(tmpdir(), 'saymd-e2e-'));
  const audio = join(work, 'memo.wav');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4', audio], { stdio: 'ignore' });

  try {
    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      HOME: work,
      GROQ_API_KEY: 'gsk_e2e_dummy',
      GROQ_BASE_URL: `http://127.0.0.1:${port}/openai/v1`,
      NO_PROXY: '127.0.0.1',
    };
    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(
        process.execPath,
        ['--import', TSX, CLI, '--provider', 'groq', '--file', audio, '--template', 'feature', '-o', '.ai/prompt.md'],
        { cwd: work, env }
      );
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (c) => (stdout += c));
      child.stderr.on('data', (c) => (stderr += c));
      child.on('close', (code) => resolve({ code, stdout, stderr }));
    });

    assert.equal(result.code, 0, `CLI failed:\n${result.stderr}\n${result.stdout}`);
    assert.match(result.stderr, /Transcribing via Groq \(whisper-large-v3-turbo\)/);
    assert.match(result.stdout, /Wrote \.ai\/prompt\.md/);

    const md = await readFile(join(work, '.ai', 'prompt.md'), 'utf8');
    assert.match(md, /dark mode toggle/i);
    assert.match(md, /Persist the choice/);

    const stt = seen.find((s) => s.path === '/openai/v1/audio/transcriptions');
    const chat = seen.find((s) => s.path === '/openai/v1/chat/completions');
    assert.ok(stt, 'transcription request sent');
    assert.ok(chat, 'structuring request sent');
    assert.equal(stt.auth, 'Bearer gsk_e2e_dummy');
    assert.match(stt.body, /whisper-large-v3-turbo/);
    assert.equal(JSON.parse(chat.body).model, 'openai/gpt-oss-120b');
  } finally {
    server.close();
    await rm(work, { recursive: true, force: true });
  }
});
