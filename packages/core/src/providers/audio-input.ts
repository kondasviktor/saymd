import { readFile } from 'node:fs/promises';

import type { TranscribeOptions } from './types.js';

/** Audio bytes and a file name, from a local path (CLI) or an in-memory buffer (cloud). */
export async function loadAudio(opts: TranscribeOptions): Promise<{ buffer: Uint8Array<ArrayBuffer>; filename: string }> {
  if (opts.data) {
    return { buffer: new Uint8Array(opts.data), filename: opts.filename ?? 'audio' };
  }
  if (!opts.localPath) throw new Error('No audio: pass localPath or data.');
  return {
    buffer: new Uint8Array(await readFile(opts.localPath)),
    filename: opts.filename ?? opts.localPath.split(/[\\/]/).pop() ?? 'audio',
  };
}
