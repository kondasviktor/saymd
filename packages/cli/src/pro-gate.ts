import { loadLicense, saveLicense, type SaymdLicense } from './config.js';
import { ensureProInstalled, importProModule } from './pro-install.js';

export type ProFeature = 'continue' | 'review' | 'out' | 'split' | 'ground' | 'mcp' | 'inbox' | 'project';

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

interface ActivationResult {
  licenseKey: string;
  proVersion?: string;
  latestVersion?: string;
  updatesUntil?: string;
}

async function exchangeActivationCode(code: string): Promise<ActivationResult> {
  const res = await fetch(ACTIVATE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim() }),
  });
  const data = (await res.json()) as {
    licenseKey?: string;
    error?: string;
    pro?: { version?: string; latestVersion?: string; updatesUntil?: string };
  };
  if (!res.ok || !data.licenseKey) {
    console.error(data.error || 'Activation failed. Check your code or email support@saymd.app.');
    process.exit(1);
  }
  return {
    licenseKey: data.licenseKey,
    proVersion: data.pro?.version,
    latestVersion: data.pro?.latestVersion,
    updatesUntil: data.pro?.updatesUntil,
  };
}

type LicenseCheck =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'invalid' }
  | { ok: false; reason: 'expired'; validUntil: string }
  | { ok: false; reason: 'updates_ended'; updatesUntil: string; releasedAt: string };

async function checkLicense(): Promise<LicenseCheck> {
  const license = await loadLicense();
  if (!license?.key || !license.signature) return { ok: false, reason: 'missing' };
  try {
    const pro = await importPro();
    if (!pro) return { ok: false, reason: 'missing' };
    if (typeof pro.licenseStatus === 'function') return pro.licenseStatus(license);
    return pro.verifyLicense(license) ? { ok: true } : { ok: false, reason: 'invalid' };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

export async function hasValidLicense(): Promise<boolean> {
  return (await checkLicense()).ok;
}

const day = (iso: string) => String(iso).slice(0, 10);

export async function requirePro(feature: ProFeature): Promise<boolean> {
  const check = await checkLicense();
  if (check.ok) return true;
  if (check.reason === 'updates_ended') {
    // Pro Local: this Pro build is newer than the license's 12 months of updates.
    console.error(`
Your Pro Local updates ended on ${day(check.updatesUntil)}, and this Pro build was released on ${day(check.releasedAt)}.

Reinstall the last Pro version your license includes:  saymd activate <activation-code>
Or buy Pro Local again for 12 more months of updates:  ${PRO_UPGRADE_URL}
`);
    return false;
  }
  if (check.reason === 'expired') {
    console.error(`
Your saymd plan ended on ${day(check.validUntil)}, so Pro features have stopped (Pro Cloud includes Pro Local only while it is paid).
The Free CLI keeps working with your own key. Renew Pro Cloud, or buy Pro Local once: ${PRO_UPGRADE_URL}
`);
    return false;
  }
  printProGate(feature);
  return false;
}

export function printProGate(feature: ProFeature): void {
  const tips: Record<ProFeature, string> = {
    continue: 'Add more speech into the same markdown file without starting over.',
    review: 'Gap-check an existing spec before you hand it to an agent.',
    out: 'Speak in one language, write the prompt in another (e.g. --out en).',
    split: 'Turn one long recording into ordered task files (.ai/tasks/01-…, 02-…) with dependencies.',
    ground: 'Ground the spec in your repo: real @paths, checked against disk.',
    mcp: 'Let Claude Code, Codex and Cursor pull voice tasks themselves: list_tasks, get_item, mark_done.',
    inbox: 'Pull the voice notes you sent the saymd Telegram bot into this repo as specs and task files.',
    project: 'Register this repo with Pro Cloud so Telegram notes can be sent here and grounded in it.',
  };
  const tip = tips[feature];

  console.error(`
${feature === 'mcp' ? 'saymd mcp' : feature === 'inbox' ? 'saymd inbox sync' : feature === 'project' ? 'saymd project add' : `--${feature}`} is Pro.

${tip}

Upgrade: ${PRO_UPGRADE_URL}
Then:    saymd activate <activation-code>
`);
  process.exit(1);
}

export async function activateLicense(rawKey: string): Promise<void> {
  let licenseRaw = rawKey.trim();
  let proVersion: string | undefined;
  let activation: ActivationResult | undefined;

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
    activation = exchanged;
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
  const status = typeof pro.licenseStatus === 'function' ? pro.licenseStatus(license) : { ok: pro.verifyLicense(license) };
  if (!status.ok) {
    console.error(
      'reason' in status && status.reason === 'expired'
        ? `This license ended on ${day(status.validUntil)}. Renew at ${PRO_UPGRADE_URL}`
        : 'Invalid activation code.'
    );
    process.exit(1);
  }
  await saveLicense(license as SaymdLicense);
  const verNote = proVersion ? ` · Pro ${proVersion}` : '';
  const lifetime = license.plan === 'local' || license.plan === 'founding';
  const until = lifetime ? 'for life' : `until ${day(license.validUntil)}`;
  const updates = license.updatesUntil
    ? ` · updates until ${day(license.updatesUntil)}`
    : license.plan === 'founding'
      ? ' · lifetime updates'
      : '';
  console.log(`Activated Pro (${license.plan}) ${until}${verNote}${updates}.`);
  if (activation?.latestVersion && activation.proVersion && activation.latestVersion !== activation.proVersion && activation.updatesUntil) {
    console.log(
      `Pro ${activation.latestVersion} is out; your 12 months of updates ended on ${day(activation.updatesUntil)}, so Pro ${activation.proVersion} is installed.\n` +
        `Buy Pro Local again for 12 more months of updates: ${PRO_UPGRADE_URL}`
    );
  }
}

async function importPro(): Promise<typeof import('@saymd/pro') | null> {
  return importProModule();
}

type ProModule = typeof import('@saymd/pro');

/**
 * Licensed Pro module that has the given export. Exits with an upgrade hint when the license
 * is missing, or an update hint when the installed Pro predates the feature.
 */
export async function requireProModule<K extends keyof ProModule>(
  feature: ProFeature,
  ...exportsNeeded: K[]
): Promise<ProModule> {
  if (!(await requirePro(feature))) process.exit(1);
  const pro = await importPro();
  if (!pro) {
    console.error('@saymd/pro not installed. Run: saymd activate <activation-code>');
    process.exit(1);
  }
  const missing = exportsNeeded.filter((k) => typeof pro[k] === 'undefined');
  if (missing.length) {
    const license = await loadLicense();
    console.error(
      license?.updatesUntil
        ? `--${feature} needs a newer Pro than your Pro Local license includes (updates until ${day(license.updatesUntil)}).\n` +
            `Buy Pro Local again for 12 more months of updates: ${PRO_UPGRADE_URL}`
        : `--${feature} needs a newer Pro. Update it with your activation code:\n  saymd activate <activation-code>`
    );
    process.exit(1);
  }
  return pro;
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
