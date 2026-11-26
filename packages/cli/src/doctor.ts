import { rm } from 'node:fs/promises';

import {
  compilerKeyEnvName,
  getProvider,
  isKnownModel,
  providerLabel,
  resolveCompilerApiKey,
  resolveCompilerProvider,
  resolveSttModel,
} from '@saymd/core';
import { ffmpegExists, micBackendHint, recordMic, commandExists } from './audio.js';
import {
  loadConfig,
  providerKeys,
  resolveProvider,
  resolveSttApiKey,
  sttKeyEnvName,
} from './config.js';

export async function runDoctor(): Promise<number> {
  let ok = true;

  console.log('saymd doctor\n');

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor >= 24) {
    console.log(`✓ Node ${process.versions.node}`);
  } else {
    console.log(`✗ Node ${process.versions.node} — saymd needs Node 24+ (https://nodejs.org)`);
    ok = false;
  }

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
  const sttModel = resolveSttModel(providerId, config.models);
  console.log(`· STT provider: ${providerLabel(providerId)} (${sttModel})`);
  if (!isKnownModel(providerId, sttModel)) {
    console.log(`! ${sttModel} isn't a model saymd knows for ${providerLabel(providerId)} — it will be tried as-is`);
  }

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

  try {
    const keys = providerKeys(config);
    const compilerProvider = resolveCompilerProvider(providerId, keys);
    const compilerKey = resolveCompilerApiKey(compilerProvider, keys);
    if (!compilerKey) {
      const env = compilerKeyEnvName(compilerProvider);
      console.log(`✗ ${env} not set (needed for prompt structuring) — run: saymd setup`);
      ok = false;
    } else if (compilerProvider === providerId && compilerKey === sttKey) {
      console.log(`· Prompt compiler: ${compilerProvider} (same key as speech-to-text)`);
    } else {
      const verifyProvider = getProvider(compilerProvider);
      await verifyProvider.verifyApiKey(compilerKey);
      console.log(`✓ Prompt compiler: ${compilerProvider} key valid`);
    }
  } catch (err) {
    console.log(`✗ Compiler key: ${(err as Error).message}`);
    ok = false;
  }

  if (ffmpegExists() && process.platform !== 'win32') {
    try {
      console.log('· Recording 1s mic test…');
      const probe = await recordMic(1, { stopOnEnter: false });
      console.log(`✓ Mic test clip: ${probe.localPath} (${probe.durationSeconds.toFixed(1)}s)`);
      await rm(probe.tempDir, { recursive: true, force: true });
    } catch (err) {
      console.log(`✗ Mic test failed: ${(err as Error).message}`);
      console.log('  Grant microphone permission or use --file with a pre-recorded clip.');
      ok = false;
    }
  }

  console.log(ok ? '\nAll checks passed.' : '\nFix the issues above, then retry.');
  if (ok) {
    console.log(`
Next
────
  saymd -o .ai/prompt.md --template feature --seconds 30

Speak, then press Enter → @ the markdown in your agent.
Need more later? saymd --continue .ai/prompt.md (Pro)
`);
  }
  return ok ? 0 : 1;
}
