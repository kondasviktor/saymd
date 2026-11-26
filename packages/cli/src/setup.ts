import { execFile } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { promisify } from 'node:util';

import { printNextAfterSetup } from './help.js';
import {
  loadConfig,
  resolveGeminiKey,
  resolveGroqKey,
  resolveOpenaiKey,
  resolveProvider,
  resolveSttApiKey,
  saveConfig,
  sttKeyEnvName,
  type SaymdConfig,
} from './config.js';
import {
  getProvider,
  isKnownModel,
  listProviders,
  RECOMMENDED_PROVIDER,
  resolveSttModel,
  STT_ONLY_PROVIDERS,
  STT_PROVIDER_IDS,
  type SttProviderId,
} from '@saymd/core';

const execFileAsync = promisify(execFile);

const PROVIDER_URLS: Record<SttProviderId, string> = {
  groq: 'https://console.groq.com/keys',
  gemini: 'https://aistudio.google.com/app/apikey',
  openai: 'https://platform.openai.com/api-keys',
  deepgram: 'https://console.deepgram.com/',
  elevenlabs: 'https://elevenlabs.io/app/settings/api-keys',
  openrouter: 'https://openrouter.ai/settings/keys',
};

const PROVIDER_NOTES: Partial<Record<SttProviderId, string>> = {
  groq: 'recommended to start — free tier, no card',
  openai: 'or gpt-4o-mini-transcribe at half the price',
  openrouter: 'one key for Gemini, OpenAI, ElevenLabs and more (--model google/gemini-3.5-transcribe)',
};

type KeyChoice = 'clipboard' | 'hidden' | 'env' | 'keep';

function setConfigKey(config: SaymdConfig, providerId: SttProviderId, key: string): void {
  switch (providerId) {
    case 'groq':
      config.groqApiKey = key;
      break;
    case 'gemini':
      config.geminiApiKey = key;
      break;
    case 'openai':
      config.openaiApiKey = key;
      break;
    case 'deepgram':
      config.deepgramApiKey = key;
      break;
    case 'elevenlabs':
      config.elevenlabsApiKey = key;
      break;
    case 'openrouter':
      config.openrouterApiKey = key;
      break;
  }
}

async function readClipboard(): Promise<string> {
  try {
    if (process.platform === 'darwin') {
      const { stdout } = await execFileAsync('pbpaste', { encoding: 'utf8' });
      return stdout.trim();
    }
    if (process.platform === 'linux') {
      try {
        const { stdout } = await execFileAsync('wl-paste', { encoding: 'utf8' });
        return stdout.trim();
      } catch {
        const { stdout } = await execFileAsync('xclip', ['-selection', 'clipboard', '-o'], {
          encoding: 'utf8',
        });
        return stdout.trim();
      }
    }
  } catch {
    return '';
  }
  return '';
}

/** Read a secret with echo disabled. Never write the value to stdout. */
function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    output.write(prompt);
    if (!input.isTTY) {
      const chunks: Buffer[] = [];
      input.on('data', (c: Buffer | string) => chunks.push(Buffer.from(c)));
      input.on('end', () => resolve(Buffer.concat(chunks).toString('utf8').trim()));
      return;
    }

    const wasRaw = Boolean(input.isRaw);
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');
    let buf = '';

    const cleanup = () => {
      input.off('data', onData);
      if (input.isTTY) input.setRawMode(wasRaw ?? false);
    };

    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\n' || ch === '\r') {
          cleanup();
          output.write('\n');
          resolve(buf.trim());
          return;
        }
        if (ch === '\u0003') {
          cleanup();
          output.write('\n');
          process.exit(130);
        }
        if (ch === '\u0004') {
          cleanup();
          output.write('\n');
          resolve(buf.trim());
          return;
        }
        if (ch === '\u007f' || ch === '\b') {
          buf = buf.slice(0, -1);
          continue;
        }
        if (ch === '\u0015') {
          buf = '';
          continue;
        }
        if (ch < ' ') continue;
        buf += ch;
      }
    };

    input.on('data', onData);
  });
}

async function collectKey(
  rl: ReturnType<typeof createInterface>,
  envName: string,
  existing: string | undefined
): Promise<{ key?: string; keep?: boolean; envOnly?: boolean }> {
  if (existing && process.env[envName]?.trim()) {
    console.log(`\n${envName} is already set in this shell (not displayed).`);
    const copy = await rl.question('Also save it to ~/.saymd/config.json? [y/N]: ');
    if (copy.trim().toLowerCase() === 'y') {
      return { key: process.env[envName]!.trim() };
    }
    return { envOnly: true };
  }

  if (existing) {
    console.log(`\n${envName} already saved in ~/.saymd/config.json (not displayed).`);
    const replace = await rl.question('Replace it? [y/N]: ');
    if (replace.trim().toLowerCase() !== 'y') return { keep: true };
  } else {
    console.log(`\nGet a key (browser): keep it in the clipboard — do not paste into chat or an AI agent.`);
  }

  console.log(`
How do you want to provide ${envName}?

  1. Clipboard (recommended) — copy the key in the browser, then choose this. Nothing is printed.
  2. Hidden paste — characters are not shown; not stored in shell history.
  3. Environment only — skip saving; export ${envName} in your shell.
${existing ? '  4. Keep existing\n' : ''}`);

  const raw = await rl.question(existing ? 'Choice [1]: ' : 'Choice [1]: ');
  const n = raw.trim() || '1';
  const choice: KeyChoice =
    n === '2' ? 'hidden' : n === '3' ? 'env' : n === '4' && existing ? 'keep' : 'clipboard';

  if (choice === 'keep') return { keep: true };
  if (choice === 'env') {
    console.log(`
Set the key in your shell (this session):

  export ${envName}='…'

Or add that line to ~/.zshrc / ~/.bashrc. Never paste keys into chat or an AI agent.
Then run: saymd doctor
`);
    return { envOnly: true };
  }

  rl.pause();
  let secret = '';
  if (choice === 'clipboard') {
    secret = await readClipboard();
    if (!secret) {
      rl.resume();
      console.error('Clipboard was empty. Copy the key in the browser, then run saymd setup again.');
      process.exit(1);
    }
  } else {
    secret = await readHidden(`Paste ${envName} (hidden): `);
    if (!secret) {
      rl.resume();
      console.error('No key provided.');
      process.exit(1);
    }
  }
  rl.resume();
  return { key: secret };
}

export async function runSetup(): Promise<void> {
  const config = await loadConfig();
  const providers = listProviders();

  console.log('saymd setup — Bring Your Own Key (BYOK)\n');
  console.log('Keys stay on your machine (~/.saymd/config.json mode 0600, or env). saymd never uploads them.\n');
  console.log('Choose your speech-to-text provider:\n');
  const recommendedIdx = Math.max(0, providers.findIndex((p) => p.id === RECOMMENDED_PROVIDER));
  providers.forEach((p, i) => {
    const note = PROVIDER_NOTES[p.id];
    console.log(`  ${i + 1}. ${p.displayName} — ${p.model}${note ? ` (${note})` : ''}`);
  });
  console.log('');

  const rl = createInterface({ input, output });
  const choice = await rl.question(
    `Provider [1-${providers.length}] (default ${recommendedIdx + 1}): `
  );
  const idx = choice.trim() ? Number(choice.trim()) - 1 : recommendedIdx;
  const provider = providers[idx] ?? providers[recommendedIdx];
  const providerId = provider.id;
  const envName = sttKeyEnvName(providerId);

  console.log(`\n${provider.displayName} key: ${PROVIDER_URLS[providerId]}`);
  if (providerId === 'groq') {
    console.log('Free tier: sign in, create a key, no card needed. Groq also structures the spec, so one key is enough.');
    console.log('Whisper is the cheapest way to start; Gemini or ElevenLabs are more accurate if you need it.');
  } else {
    console.log('Typical 60-second dictation costs well under $0.01 on your key (BYOK).');
  }

  const existingStt = resolveSttApiKey(providerId, config);
  const stt = await collectKey(rl, envName, existingStt);

  if (stt.key) {
    process.stdout.write('Verifying STT key… ');
    await provider.verifyApiKey(stt.key);
    console.log('OK');
    setConfigKey(config, providerId, stt.key);
  } else if (!stt.keep && !stt.envOnly && !existingStt) {
    rl.close();
    console.error('No key provided.');
    process.exit(1);
  } else if (stt.envOnly && !resolveSttApiKey(providerId, config)) {
    rl.close();
    process.exit(0);
  }

  config.provider = providerId;

  if (STT_ONLY_PROVIDERS.includes(providerId)) {
    const hasCompiler = resolveGeminiKey(config) || resolveOpenaiKey(config) || resolveGroqKey(config);
    if (!hasCompiler) {
      console.log(
        '\nDeepgram and ElevenLabs are STT-only — saymd needs a Gemini, OpenAI or Groq key to turn the transcript into a prompt file.'
      );
      const compilerChoice = await rl.question('Compiler — 1) Gemini  2) OpenAI  3) Groq (free tier) [1]: ');
      const compilerId: SttProviderId =
        compilerChoice.trim() === '2' ? 'openai' : compilerChoice.trim() === '3' ? 'groq' : 'gemini';
      const compilerEnv = sttKeyEnvName(compilerId);
      console.log(`Get a key: ${PROVIDER_URLS[compilerId]}`);
      const compiler = await collectKey(rl, compilerEnv, undefined);
      if (!compiler.key) {
        rl.close();
        console.error('Compiler key required for STT-only providers.');
        process.exit(1);
      }
      const compilerProvider = getProvider(compilerId);
      process.stdout.write('Verifying compiler key… ');
      await compilerProvider.verifyApiKey(compiler.key);
      console.log('OK');
      setConfigKey(config, compilerId, compiler.key);
    }
  }

  rl.close();

  await saveConfig(config);
  console.log(`\nSaved provider to ~/.saymd/config.json (mode 0600). Default: ${providerId}.`);
  if (stt.envOnly) {
    console.log(`Using ${envName} from the environment (not written to disk).`);
  } else {
    console.log('API key stored locally only — never shown again by saymd.');
  }
  printNextAfterSetup(providerId);
}

export async function runConfigShow(): Promise<void> {
  const config = await loadConfig();
  const flag = (v?: string) => (v?.trim() || undefined ? 'set (local)' : undefined);
  const env = (name: string) => (process.env[name]?.trim() ? 'set (env)' : undefined);
  const groq = env('GROQ_API_KEY') || flag(config.groqApiKey) || 'not set';
  const gemini = env('GEMINI_API_KEY') || flag(config.geminiApiKey) || 'not set';
  const openai = env('OPENAI_API_KEY') || flag(config.openaiApiKey) || 'not set';
  const deepgram = env('DEEPGRAM_API_KEY') || flag(config.deepgramApiKey) || 'not set';
  const eleven = env('ELEVENLABS_API_KEY') || flag(config.elevenlabsApiKey) || 'not set';
  const openrouter = env('OPENROUTER_API_KEY') || flag(config.openrouterApiKey) || 'not set';
  const providerId = resolveProvider(config);
  const model = resolveSttModel(providerId, config.models);
  console.log(`provider:   ${config.provider ?? 'gemini (default)'}
model:      ${model}${config.models?.[providerId] ? ' (config)' : ''}
config:     ~/.saymd/config.json
GROQ:       ${groq}
GEMINI:     ${gemini}
OPENAI:     ${openai}
DEEPGRAM:   ${deepgram}
ELEVENLABS: ${eleven}
OPENROUTER: ${openrouter}

Change provider: saymd config set provider openai
Change model:    saymd config set model gpt-4o-mini-transcribe
Re-enter keys:   saymd setup`);
}

export async function runConfigSet(key: string, value: string): Promise<void> {
  const config = await loadConfig();
  if (key === 'provider') {
    if (!(STT_PROVIDER_IDS as string[]).includes(value)) {
      console.error(`Provider must be: ${STT_PROVIDER_IDS.join(', ')}`);
      process.exit(1);
    }
    config.provider = value as SttProviderId;
    await saveConfig(config);
    console.log(`Default provider set to ${value}.`);
    return;
  }
  if (key === 'model') {
    const providerId = resolveProvider(config);
    const models = { ...(config.models ?? {}) };
    if (value === 'default') {
      delete models[providerId];
      config.models = models;
      await saveConfig(config);
      console.log(`${getProvider(providerId).displayName} model reset to ${getProvider(providerId).model}.`);
      return;
    }
    models[providerId] = value;
    config.models = models;
    await saveConfig(config);
    console.log(`${getProvider(providerId).displayName} model set to ${value}.`);
    if (!isKnownModel(providerId, value)) {
      const known = Object.keys(getProvider(providerId).knownModels ?? {}).join(', ');
      console.log(`Note: saymd doesn't know this model for ${providerId}${known ? ` (known: ${known})` : ''}. It will be tried as-is.`);
    }
    return;
  }
  console.error(`Unknown config key: ${key}. Supported: provider, model`);
  process.exit(1);
}
