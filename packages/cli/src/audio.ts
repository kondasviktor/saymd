import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface AudioProbe {
  durationSeconds: number;
  localPath: string;
  mimeType: string;
  tempDir: string;
}

export function commandExists(cmd: string): boolean {
  const r = spawnSync('which', [cmd], { encoding: 'utf8' });
  return r.status === 0 && Boolean(r.stdout?.trim());
}

export function ffmpegExists(): boolean {
  return commandExists('ffmpeg');
}

export async function normalizeAudio(inputPath: string): Promise<AudioProbe> {
  if (!ffmpegExists()) {
    throw new Error('ffmpeg not found. Install ffmpeg and run saymd doctor.');
  }
  const tempDir = await mkdtemp(join(tmpdir(), 'saymd-'));
  const outPath = join(tempDir, 'normalized.wav');
  await runFfmpeg([
    '-y',
    '-i',
    inputPath,
    '-ar',
    '16000',
    '-ac',
    '1',
    '-c:a',
    'pcm_s16le',
    outPath,
  ]);
  const duration = probeDuration(outPath);
  return { durationSeconds: duration, localPath: outPath, mimeType: 'audio/wav', tempDir };
}

function probeDuration(path: string): number {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path],
    { encoding: 'utf8' }
  );
  const sec = Number(r.stdout?.trim());
  if (!Number.isFinite(sec) || sec <= 0) return 0;
  return sec;
}

export async function recordMic(seconds: number): Promise<AudioProbe> {
  if (!ffmpegExists()) throw new Error('ffmpeg not found.');
  const tempDir = await mkdtemp(join(tmpdir(), 'saymd-rec-'));
  const outPath = join(tempDir, 'recording.wav');
  const platform = process.platform;

  if (platform === 'darwin') {
    await runFfmpeg(['-y', '-f', 'avfoundation', '-i', ':0', '-t', String(seconds), '-ar', '16000', '-ac', '1', outPath]);
  } else if (platform === 'linux') {
    await runFfmpeg(['-y', '-f', 'alsa', '-i', 'default', '-t', String(seconds), '-ar', '16000', '-ac', '1', outPath]);
  } else {
    throw new Error('Recording supported on macOS and Linux only. Use WSL on Windows or pass --file.');
  }

  return {
    durationSeconds: probeDuration(outPath) || seconds,
    localPath: outPath,
    mimeType: 'audio/wav',
    tempDir,
  };
}

export async function splitLongAudio(
  inputPath: string,
  maxChunkSeconds = 600
): Promise<{ chunkPaths: string[]; tempDir: string; mimeType: string }> {
  const tempDir = await mkdtemp(join(tmpdir(), 'saymd-chunks-'));
  const duration = probeDuration(inputPath);
  if (duration <= maxChunkSeconds) {
    return { chunkPaths: [inputPath], tempDir, mimeType: 'audio/wav' };
  }
  const chunkPaths: string[] = [];
  let start = 0;
  let idx = 0;
  while (start < duration) {
    const out = join(tempDir, `chunk-${idx}.wav`);
    await runFfmpeg([
      '-y',
      '-ss',
      String(start),
      '-t',
      String(maxChunkSeconds),
      '-i',
      inputPath,
      '-ar',
      '16000',
      '-ac',
      '1',
      out,
    ]);
    chunkPaths.push(out);
    start += maxChunkSeconds;
    idx++;
  }
  return { chunkPaths, tempDir, mimeType: 'audio/wav' };
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    proc.stderr?.on('data', (d) => {
      err += String(d);
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.slice(-500) || `ffmpeg exited ${code}`));
    });
  });
}

export async function cleanupAudio(probe: AudioProbe | undefined): Promise<void> {
  if (!probe?.tempDir) return;
  await rm(probe.tempDir, { recursive: true, force: true }).catch(() => undefined);
}

export function micBackendHint(): string {
  if (process.platform === 'darwin') return 'avfoundation (:0 default mic)';
  if (process.platform === 'linux') return 'alsa default';
  return 'unsupported — use --file or WSL';
}
