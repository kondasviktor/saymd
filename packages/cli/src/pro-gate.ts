import { loadLicense, saveLicense, type SaymdLicense } from './config.js';
import { ensureProInstalled, importProModule } from './pro-install.js';

export type ProFeature = 'continue' | 'review' | 'out';

export const PRO_UPGRADE_URL = 'https://saymd.app/pricing.html';

/** Free cap — enforced in this repo. Pro duration is enforced via @saymd/pro. */
export const FREE_MAX_SECONDS = 60;
/** Help / upgrade copy only. Do not use these to unlock longer recordings. */
export const PRO_DEFAULT_SECONDS = 120;
export const PRO_MAX_MIC_SECONDS = 600;
const ACTIVATE_API_URL = process.env.SAYMD_ACTIVATE_URL || 'https://saymd.app/api/activate';

function isShortActivationCode(raw: string): boolean {
  const n = raw.trim().replace(/-/g, '');
  return n.length >= 16 && n.length <= 32 && /^[a-zA-Z0-9]+$/.test(n) && !raw.includes('.');
}

async function exchangeActivationCode(
  code: string
): Promise<{ licenseKey: string; proVersion?: string }> {
  const res = await fetch(ACTIVATE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim() }),
  });
  const data = (await res.json()) as {
    licenseKey?: string;
    error?: string;
    pro?: { version?: string };
  };
  if (!res.ok || !data.licenseKey) {
    console.error(data.error || 'Activation failed. Check your code or email support@saymd.app.');
    process.exit(1);
  }
  return { licenseKey: data.licenseKey, proVersion: data.pro?.version };
}

export async function hasValidLicense(): Promise<boolean> {
  const license = await loadLicense();
  if (!license?.key || !license.signature) return false;
  try {
    const pro = await importPro();
    if (!pro) return false;
    return pro.verifyLicense(license);
  } catch {
    return false;
  }
}

export async function requirePro(feature: ProFeature): Promise<boolean> {
  if (await hasValidLicense()) return true;
  printProGate(feature);
  return false;
}

export function printProGate(feature: ProFeature): void {
  const tip =
    feature === 'continue'
      ? 'Add more speech into the same markdown file without starting over.'
      : feature === 'review'
        ? 'Gap-check an existing spec before you hand it to an agent.'
        : 'Speak in one language, write the prompt in another (e.g. --out en).';

  console.error(`
--${feature} is Pro.

${tip}

Upgrade: ${PRO_UPGRADE_URL}
Then:    saymd activate <activation-code>
`);
  process.exit(1);
}

export async function activateLicense(rawKey: string): Promise<void> {
  let licenseRaw = rawKey.trim();
  let proVersion: string | undefined;

  if (isShortActivationCode(licenseRaw)) {
    const exchanged = await exchangeActivationCode(licenseRaw);
    try {
      await ensureProInstalled({ code: licenseRaw, version: exchanged.proVersion, force: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Could not install Pro: ${msg}`);
      console.error('License was not saved. Email support@saymd.app if this persists.');
      process.exit(1);
    }
    licenseRaw = exchanged.licenseKey;
    proVersion = exchanged.proVersion;
  } else {
    // Full license key paste — Pro must already be resolvable (link or prior install).
    const existing = await importPro();
    if (!existing) {
      console.error(
        'Pro is not installed. Use the short activation code from saymd.app (not the raw license blob):\n  saymd activate <activation-code>'
      );
      process.exit(1);
    }
  }

  const pro = await importPro();
  if (!pro) {
    console.error('Pro install finished but module could not be loaded.');
    process.exit(1);
  }
  const license = pro.parseLicenseKey(licenseRaw);
  if (!pro.verifyLicense(license)) {
    console.error('Invalid activation code.');
    process.exit(1);
  }
  await saveLicense(license as SaymdLicense);
  const verNote = proVersion ? ` · Pro ${proVersion}` : '';
  console.log(`Activated Pro (${license.plan}) until ${license.validUntil}${verNote}.`);
}

async function importPro(): Promise<typeof import('@saymd/pro') | null> {
  return importProModule();
}

export async function runContinue(opts: {
  apiKey: string;
  targetPath: string;
  dryRun: boolean;
  cwd: string;
  newMarkdown?: string;
  newSections?: import('./types.js').SaymdSections;
  template?: import('./types.js').TemplateId;
}): Promise<string> {
  const allowed = await requirePro('continue');
  if (!allowed) return '';

  const pro = await importPro();
  if (!pro) {
    console.error('@saymd/pro not installed. Run: saymd activate <activation-code>');
    process.exit(1);
  }
  return pro.mergeContinue(opts);
}

export async function runReview(opts: {
  apiKey: string;
  targetPath: string;
  cwd: string;
}): Promise<void> {
  const allowed = await requirePro('review');
  if (!allowed) return;

  const pro = await importPro();
  if (!pro) {
    console.error('@saymd/pro not installed. Run: saymd activate <activation-code>');
    process.exit(1);
  }
  await pro.reviewSpec(opts);
}

export async function requireCrossLang(outLang: string | undefined): Promise<void> {
  if (!outLang) return;
  const allowed = await requirePro('out');
  if (!allowed) process.exit(1);
}

/** Pro recording limits. Returns null on Free or if @saymd/pro is missing. */
export async function getProRecordingLimits(): Promise<{
  defaultSeconds: number;
  maxMicSeconds: number;
  maxFileSeconds: number;
} | null> {
  if (!(await hasValidLicense())) return null;
  const pro = await importPro();
  if (!pro?.getRecordingLimits) return null;
  return pro.getRecordingLimits();
}

/** Cross-language + vocab prompt lines. Empty unless Pro is installed and licensed. */
export async function getProCompilerAddendum(opts: {
  vocab: string[];
  outLang?: string;
}): Promise<string> {
  if (!opts.outLang && opts.vocab.length === 0) return '';
  if (!(await hasValidLicense())) return '';
  const pro = await importPro();
  if (!pro?.proCompilerAddendum) return '';
  return pro.proCompilerAddendum(opts);
}
