import { rm } from 'node:fs/promises';

import { resolveCompilerApiKey, resolveCompilerProvider } from './compiler/index.js';
import { ffmpegExists, micBackendHint, recordMic, commandExists } from './audio.js';
import {
  loadConfig,
  resolveProvider,
  resolveSttApiKey,
  sttKeyEnvName,
} from './config.js';
import { getProvider, providerLabel } from './providers/index.js';
import { STT_ONLY_PROVIDERS } from './providers/types.js';

export async function runDoctor(): Promise<number> {
  let ok = true;

  console.log('saymd doctor\n');

  if (ffmpegExists()) {
    console.log('✓ ffmpeg found');
  } else {
    console.log('✗ ffmpeg missing — install: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)');
    ok = false;
  }

  if (commandExists('ffprobe')) {
    console.log('✓ ffprobe found');
  } else {
    console.log('✗ ffprobe missing (usually bundled with ffmpeg)');
    ok = false;
  }

  console.log(`· Mic backend: ${micBackendHint()}`);

  const config = await loadConfig();
  const providerId = resolveProvider(config);
  const provider = getProvider(providerId);
  console.log(`· STT provider: ${providerLabel(providerId)} (${provider.model})`);

  const sttKey = resolveSttApiKey(providerId, config);
  if (!sttKey) {
    console.log(`✗ ${sttKeyEnvName(providerId)} not set — run: saymd setup`);
    ok = false;
  } else {
    try {
      await provider.verifyApiKey(sttKey);
      console.log(`✓ ${sttKeyEnvName(providerId)} valid`);
    } catch (err) {
      console.log(`✗ ${sttKeyEnvName(providerId)} invalid: ${(err as Error).message}`);
      ok = false;
    }
  }

  if (STT_ONLY_PROVIDERS.includes(providerId) || providerId === 'gemini' || providerId === 'openai') {
    try {
      const compilerProvider = resolveCompilerProvider(providerId, config);
      const compilerKey = resolveCompilerApiKey(compilerProvider, config);
      if (!compilerKey) {
        const env = compilerProvider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
        console.log(`✗ ${env} not set (needed for prompt structuring) — run: saymd setup`);
        ok = false;
      } else {
        const verifyProvider = getProvider(compilerProvider);
        await verifyProvider.verifyApiKey(compilerKey);
        console.log(`✓ Prompt compiler: ${compilerProvider} key valid`);
      }
    } catch (err) {
      console.log(`✗ Compiler key: ${(err as Error).message}`);
      ok = false;
    }
  }

  if (ffmpegExists() && process.platform !== 'win32') {
    try {
      console.log('· Recording 1s mic test…');
      const probe = await recordMic(1);
      console.log(`✓ Mic test clip: ${probe.localPath} (${probe.durationSeconds.toFixed(1)}s)`);
      await rm(probe.tempDir, { recursive: true, force: true });
    } catch (err) {
      console.log(`✗ Mic test failed: ${(err as Error).message}`);
      console.log('  Grant microphone permission or use --file with a pre-recorded clip.');
      ok = false;
    }
  }

  console.log(ok ? '\nAll checks passed.' : '\nFix the issues above, then retry.');
  return ok ? 0 : 1;
}
