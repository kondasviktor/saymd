import { mkdir, readFile, writeFile, chmod, access, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { createJsonLlm, STT_PROVIDER_IDS, type ProviderKeys, type SttProviderId } from '@saymd/core';

export const SAYMD_DIR = join(homedir(), '.saymd');
export const CONFIG_PATH = join(SAYMD_DIR, 'config.json');
export const STATE_PATH = join(SAYMD_DIR, 'state.json');
export const LICENSE_PATH = join(SAYMD_DIR, 'license.json');

export interface SaymdConfig {
  provider?: SttProviderId;
  /** Per-provider STT model override, set with `saymd config set model <id>`. */
  models?: Partial<Record<SttProviderId, string>>;
  groqApiKey?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  deepgramApiKey?: string;
  elevenlabsApiKey?: string;
  openrouterApiKey?: string;
  defaultTemplate?: string;
  defaultOutput?: string;
}

export interface SaymdState {
  lastOutputPath?: string;
}

export interface SaymdLicense {
  email: string;
  plan: 'local' | 'founding' | 'cloud_monthly' | 'cloud_annual' | 'annual' | 'monthly';
  validUntil: string;
  key: string;
  signature: string;
  /** Pro Local: end of the 12 months of updates (also inside the signed key, which is what counts). */
  updatesUntil?: string;
}

export async function ensureSaymdDir(): Promise<void> {
  await mkdir(SAYMD_DIR, { recursive: true, mode: 0o700 });
}

export async function loadConfig(): Promise<SaymdConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(raw) as SaymdConfig;
  } catch {
    return {};
  }
}

export async function saveConfig(config: SaymdConfig): Promise<void> {
  await ensureSaymdDir();
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  await chmod(CONFIG_PATH, 0o600);
}

export async function loadState(): Promise<SaymdState> {
  try {
    const raw = await readFile(STATE_PATH, 'utf8');
    return JSON.parse(raw) as SaymdState;
  } catch {
    return {};
  }
}

export async function saveState(state: SaymdState): Promise<void> {
  await ensureSaymdDir();
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

export async function loadLicense(): Promise<SaymdLicense | null> {
  try {
    const raw = await readFile(LICENSE_PATH, 'utf8');
    return JSON.parse(raw) as SaymdLicense;
  } catch {
    return null;
  }
}

export async function saveLicense(license: SaymdLicense): Promise<void> {
  await ensureSaymdDir();
  await writeFile(LICENSE_PATH, JSON.stringify(license, null, 2) + '\n', { mode: 0o600 });
  await chmod(LICENSE_PATH, 0o600);
}

export function isSttProviderId(value: string): value is SttProviderId {
  return (STT_PROVIDER_IDS as string[]).includes(value);
}

export function resolveProvider(config: SaymdConfig, cliOverride?: SttProviderId): SttProviderId {
  if (cliOverride) return cliOverride;
  if (config.provider && isSttProviderId(config.provider)) return config.provider;
  return 'gemini';
}

export function resolveGeminiKey(config: SaymdConfig): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || config.geminiApiKey?.trim() || undefined;
}

export function resolveOpenaiKey(config: SaymdConfig): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || config.openaiApiKey?.trim() || undefined;
}

export function resolveGroqKey(config: SaymdConfig): string | undefined {
  return process.env.GROQ_API_KEY?.trim() || config.groqApiKey?.trim() || undefined;
}

export function resolveDeepgramKey(config: SaymdConfig): string | undefined {
  return process.env.DEEPGRAM_API_KEY?.trim() || config.deepgramApiKey?.trim() || undefined;
}

export function resolveElevenlabsKey(config: SaymdConfig): string | undefined {
  return process.env.ELEVENLABS_API_KEY?.trim() || config.elevenlabsApiKey?.trim() || undefined;
}

export function resolveOpenrouterKey(config: SaymdConfig): string | undefined {
  return process.env.OPENROUTER_API_KEY?.trim() || config.openrouterApiKey?.trim() || undefined;
}

export function resolveSttApiKey(provider: SttProviderId, config: SaymdConfig): string | undefined {
  switch (provider) {
    case 'groq':
      return resolveGroqKey(config);
    case 'gemini':
      return resolveGeminiKey(config);
    case 'openai':
      return resolveOpenaiKey(config);
    case 'deepgram':
      return resolveDeepgramKey(config);
    case 'elevenlabs':
      return resolveElevenlabsKey(config);
    case 'openrouter':
      return resolveOpenrouterKey(config);
  }
}

/** Every provider key the user has (env first, then ~/.saymd/config.json), for @saymd/core. */
export function providerKeys(config: SaymdConfig): ProviderKeys {
  const keys: ProviderKeys = {};
  for (const id of STT_PROVIDER_IDS) {
    const key = resolveSttApiKey(id, config);
    if (key) keys[id] = key;
  }
  return keys;
}

/** Text-model key for Pro --continue/--review.
 * Prefer OpenAI when OPENAI_BASE_URL is set (e.g. OpenRouter), else Gemini then OpenAI.
 */
export function resolveTextApiKey(config: SaymdConfig): string | undefined {
  if (process.env.OPENAI_BASE_URL?.trim()) {
    return resolveOpenaiKey(config) ?? resolveGeminiKey(config);
  }
  return resolveGeminiKey(config) ?? resolveOpenaiKey(config);
}

/**
 * The LLM Pro's own features use (--continue, --review, --out): the structuring provider of the configured
 * speech provider, so OpenRouter, Groq, Gemini or OpenAI all work. `apiKey` (Gemini/OpenAI) stays for older Pro.
 */
export function resolveProLlm(config: SaymdConfig, provider: SttProviderId): { llm?: (prompt: string) => Promise<string>; apiKey?: string } {
  const apiKey = resolveTextApiKey(config);
  try {
    return { llm: createJsonLlm(provider, providerKeys(config)).llm, apiKey };
  } catch {
    return { apiKey };
  }
}

/** @deprecated Use resolveTextApiKey or resolveSttApiKey */
export function resolveApiKey(config: SaymdConfig): string | undefined {
  return resolveTextApiKey(config);
}

export function sttKeyEnvName(provider: SttProviderId): string {
  switch (provider) {
    case 'groq':
      return 'GROQ_API_KEY';
    case 'gemini':
      return 'GEMINI_API_KEY';
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'deepgram':
      return 'DEEPGRAM_API_KEY';
    case 'elevenlabs':
      return 'ELEVENLABS_API_KEY';
    case 'openrouter':
      return 'OPENROUTER_API_KEY';
  }
}

export function configKeyField(provider: SttProviderId): keyof SaymdConfig {
  switch (provider) {
    case 'groq':
      return 'groqApiKey';
    case 'gemini':
      return 'geminiApiKey';
    case 'openai':
      return 'openaiApiKey';
    case 'deepgram':
      return 'deepgramApiKey';
    case 'elevenlabs':
      return 'elevenlabsApiKey';
    case 'openrouter':
      return 'openrouterApiKey';
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function loadProjectConfig(cwd: string): Promise<{ out?: string; in?: string }> {
  const path = join(cwd, '.saymd', 'config.json');
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as { out?: string; in?: string };
  } catch {
    return {};
  }
}

export async function loadVocab(cwd: string): Promise<string[]> {
  const path = join(cwd, '.saymd', 'vocab.txt');
  try {
    const raw = await readFile(path, 'utf8');
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function cleanupTemp(path: string | undefined): Promise<void> {
  if (!path) return;
  await rm(path, { force: true }).catch(() => undefined);
}
