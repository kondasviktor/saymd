import { loadLicense, saveLicense, type SaymdLicense } from './config.js';

export type ProFeature = 'continue' | 'review' | 'out';

const PRO_UPGRADE_URL = 'https://saymd.app/pricing.html';
const ACTIVATE_API_URL = process.env.SAYMD_ACTIVATE_URL || 'https://saymd.app/api/activate';

function isShortActivationCode(raw: string): boolean {
  const n = raw.trim().replace(/-/g, '');
  return n.length >= 16 && n.length <= 32 && /^[a-zA-Z0-9]+$/.test(n) && !raw.includes('.');
}

async function exchangeActivationCode(code: string): Promise<string> {
  const res = await fetch(ACTIVATE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim() }),
  });
  const data = (await res.json()) as { licenseKey?: string; error?: string };
  if (!res.ok || !data.licenseKey) {
    console.error(data.error || 'Activation failed. Check your code or email support@saymd.app.');
    process.exit(1);
  }
  return data.licenseKey;
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
  console.error(`
--${feature} is a Pro feature.

Free CLI stays MIT. Unlock --continue, --review, and --out: €39/year → ${PRO_UPGRADE_URL}
`);
  process.exit(1);
}

export async function activateLicense(rawKey: string): Promise<void> {
  const pro = await importPro();
  if (!pro) {
    console.error('Install Pro support: npm install -g @saymd/pro');
    process.exit(1);
  }
  let licenseRaw = rawKey.trim();
  if (isShortActivationCode(licenseRaw)) {
    licenseRaw = await exchangeActivationCode(licenseRaw);
  }
  const license = pro.parseLicenseKey(licenseRaw);
  if (!pro.verifyLicense(license)) {
    console.error('Invalid activation code.');
    process.exit(1);
  }
  await saveLicense(license as SaymdLicense);
  console.log(`Activated Pro (${license.plan}) until ${license.validUntil}.`);
}

async function importPro(): Promise<typeof import('@saymd/pro') | null> {
  try {
    return await import('@saymd/pro');
  } catch {
    return null;
  }
}

export async function runContinue(opts: {
  apiKey: string;
  targetPath: string;
  dryRun: boolean;
  cwd: string;
  newMarkdown?: string;
  newSections?: import('./types.js').SaymdSections;
}): Promise<string> {
  const allowed = await requirePro('continue');
  if (!allowed) return '';

  const pro = await importPro();
  if (!pro) {
    console.error('@saymd/pro not installed. npm install -g @saymd/pro');
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
    console.error('@saymd/pro not installed.');
    process.exit(1);
  }
  await pro.reviewSpec(opts);
}

export async function requireCrossLang(outLang: string | undefined): Promise<void> {
  if (!outLang) return;
  const allowed = await requirePro('out');
  if (!allowed) process.exit(1);
}
