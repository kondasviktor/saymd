import { loadLicense, saveLicense, type SaymdLicense } from './config.js';

export type ProFeature = 'continue' | 'review' | 'out';

const PRO_UPGRADE_URL = 'https://saymd.app/pricing.html';

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
  const license = pro.parseLicenseKey(rawKey);
  if (!pro.verifyLicense(license)) {
    console.error('Invalid license key.');
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
