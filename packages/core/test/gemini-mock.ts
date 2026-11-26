import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface MockRequest {
  method: string;
  path: string;
  apiKey?: string;
  body: string;
  json?: Record<string, unknown>;
}

export interface GeminiMock {
  /** Value for GEMINI_BASE_URL. */
  url: string;
  requests: MockRequest[];
  close(): Promise<void>;
}

function read(req: IncomingMessage): Promise<Buffer> {
  return new Promise((r) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => r(Buffer.concat(chunks)));
  });
}

/**
 * Local stand-in for the Gemini API, covering what saymd calls:
 * Files API resumable upload, Interactions API (gemini-3.5-transcribe), and generateContent.
 * `reply(model, prompt)` returns the text for a generateContent call.
 */
export async function startGeminiMock(opts: {
  /** Transcript the Interactions API returns; a function is read on every request. */
  transcript: string | (() => string);
  reply: (model: string, prompt: string) => string;
}): Promise<GeminiMock> {
  const requests: MockRequest[] = [];
  let base = '';
  let files = 0;
  const server: Server = createServer(async (req, res) => {
    const raw = await read(req);
    const path = (req.url ?? '').split('?')[0];
    const isUpload = path.startsWith('/upload-session/');
    const body = isUpload ? `<${raw.length} bytes>` : raw.toString('utf8');
    let json: Record<string, unknown> | undefined;
    try {
      json = isUpload ? undefined : (JSON.parse(body) as Record<string, unknown>);
    } catch {
      /* not JSON */
    }
    requests.push({ method: req.method ?? '', path, apiKey: req.headers['x-goog-api-key'] as string | undefined, body, json });
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'POST' && path === '/upload/v1beta/files') {
      const id = ++files;
      res.setHeader('x-goog-upload-url', `${base}/upload-session/${id}`);
      res.setHeader('x-goog-upload-status', 'active');
      res.end('{}');
      return;
    }
    if (isUpload) {
      const id = path.split('/').pop();
      res.setHeader('x-goog-upload-status', 'final');
      res.end(
        JSON.stringify({
          file: { name: `files/mock${id}`, uri: `${base}/v1beta/files/mock${id}`, mimeType: 'audio/wav', state: 'ACTIVE' },
        })
      );
      return;
    }
    if (req.method === 'DELETE' && path.startsWith('/v1beta/files/')) {
      res.end('{}');
      return;
    }
    if (req.method === 'GET' && path.startsWith('/v1beta/files/')) {
      res.end(JSON.stringify({ name: path.slice('/v1beta/'.length), uri: `${base}${path}`, mimeType: 'audio/wav', state: 'ACTIVE' }));
      return;
    }
    if (req.method === 'POST' && path === '/v1beta/interactions') {
      res.end(
        JSON.stringify({
          id: 'interaction-1',
          status: 'completed',
          model: json?.model,
          steps: [
            {
              type: 'model_output',
              content: [{ type: 'text', text: typeof opts.transcript === 'function' ? opts.transcript() : opts.transcript }],
            },
          ],
        })
      );
      return;
    }
    const gen = path.match(/^\/v1beta\/models\/([^:]+):generateContent$/);
    if (req.method === 'POST' && gen) {
      const contents = (json?.contents ?? []) as Array<{ parts?: Array<{ text?: string }> }>;
      const prompt = contents.flatMap((c) => c.parts ?? []).map((p) => p.text ?? '').join('\n');
      res.end(
        JSON.stringify({
          candidates: [{ content: { role: 'model', parts: [{ text: opts.reply(gen[1], prompt) }] }, finishReason: 'STOP' }],
        })
      );
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: { code: 404, message: `mock: no route for ${req.method} ${path}` } }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url: base, requests, close: () => new Promise((r) => server.close(() => r())) };
}
