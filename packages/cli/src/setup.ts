import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { resolveCompilerProvider } from './compiler/index.js';
import {
  configKeyField,
  loadConfig,
  resolveGeminiKey,
  resolveOpenaiKey,
  resolveSttApiKey,
  saveConfig,
  sttKeyEnvName,
} from './config.js';
import { getProvider, listProviders } from './providers/index.js';
import { STT_ONLY_PROVIDERS } from './providers/types.js';
import type { SttProviderId } from './providers/types.js';

const PROVIDER_URLS: Record<SttProviderId, string> = {
  gemini: 'https://aistudio.google.com/app/apikey',
  openai: 'https://platform.openai.com/api-keys',
  deepgram: 'https://console.deepgram.com/',
  elevenlabs: 'https://elevenlabs.io/app/settings/api-keys',
};

export async function runSetup(): Promise<void> {
  const config = await loadConfig();
  const providers = listProviders();

  console.log('saymd setup — Bring Your Own Key (BYOK)\n');
  console.log('Choose your speech-to-text provider:\n');
  providers.forEach((p, i) => {
    const rec = p.id === 'gemini' ? ' (recommended)' : '';
    console.log(`  ${i + 1}. ${p.displayName} — ${p.model}${rec}`);
  });
  console.log('');

  const rl = createInterface({ input, output });
  const choice = await rl.question(`Provider [1-${providers.length}] (default 1): `);
  const idx = choice.trim() ? Number(choice.trim()) - 1 : 0;
  const provider = providers[idx] ?? providers[0];
  const providerId = provider.id;

  const existingStt = resolveSttApiKey(providerId, config);
  if (existingStt) {
    console.log(`\n${sttKeyEnvName(providerId)} already configured (~/.saymd/config.json or env).`);
    console.log('Paste a new key to replace it, or press Enter to keep the existing key.');
  } else {
    console.log(`\nGet a ${provider.displayName} API key: ${PROVIDER_URLS[providerId]}`);
    console.log('Typical 60-second dictation costs well under $0.01 on your key (BYOK).');
  }

  const keyPrompt = await rl.question(
    `\nPaste ${sttKeyEnvName(providerId)} (input hidden in shell — paste carefully): `
  );
  const trimmedStt = keyPrompt.trim();

  if (trimmedStt) {
    process.stdout.write('Verifying STT key… ');
    await provider.verifyApiKey(trimmedStt);
    console.log('OK');
    const field = configKeyField(providerId);
    if (field === 'geminiApiKey') config.geminiApiKey = trimmedStt;
    else if (field === 'openaiApiKey') config.openaiApiKey = trimmedStt;
    else if (field === 'deepgramApiKey') config.deepgramApiKey = trimmedStt;
    else config.elevenlabsApiKey = trimmedStt;
  } else if (!existingStt) {
    rl.close();
    console.error('No key provided.');
    process.exit(1);
  }

  config.provider = providerId;

  if (STT_ONLY_PROVIDERS.includes(providerId)) {
    const hasCompiler = resolveGeminiKey(config) || resolveOpenaiKey(config);
    if (!hasCompiler) {
      console.log(
        '\nDeepgram and ElevenLabs are STT-only — saymd needs a Gemini or OpenAI key to turn the transcript into a prompt file.'
      );
      const compilerChoice = await rl.question('Add compiler key — 1) Gemini  2) OpenAI [1]: ');
      const useOpenai = compilerChoice.trim() === '2';
      const compilerUrl = useOpenai ? PROVIDER_URLS.openai : PROVIDER_URLS.gemini;
      const compilerEnv = useOpenai ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY';
      console.log(`Get a key: ${compilerUrl}`);
      const compilerKeyInput = await rl.question(`Paste ${compilerEnv}: `);
      const trimmedCompiler = compilerKeyInput.trim();
      if (!trimmedCompiler) {
        rl.close();
        console.error('Compiler key required for STT-only providers.');
        process.exit(1);
      }
      const compilerProvider = getProvider(useOpenai ? 'openai' : 'gemini');
      process.stdout.write('Verifying compiler key… ');
      await compilerProvider.verifyApiKey(trimmedCompiler);
      console.log('OK');
      if (useOpenai) config.openaiApiKey = trimmedCompiler;
      else config.geminiApiKey = trimmedCompiler;
    }
  }

  rl.close();

  await saveConfig(config);
  console.log(`\nSaved to ~/.saymd/config.json (mode 0600). Default provider: ${providerId}.`);
}

export async function runConfigSet(key: string, value: string): Promise<void> {
  const config = await loadConfig();
  if (key === 'provider') {
    if (!['gemini', 'openai', 'deepgram', 'elevenlabs'].includes(value)) {
      console.error('Provider must be: gemini, openai, deepgram, or elevenlabs');
      process.exit(1);
    }
    config.provider = value as SttProviderId;
    await saveConfig(config);
    console.log(`Default provider set to ${value}.`);
    return;
  }
  console.error(`Unknown config key: ${key}. Supported: provider`);
  process.exit(1);
}
