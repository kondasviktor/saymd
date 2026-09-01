import { createPublicKey, verify, sign, createPrivateKey } from 'node:crypto';

/** Embedded public key (DER base64). Regenerate with: npm run generate-keys -w @saymd/pro */
export const LICENSE_PUBLIC_KEY_DER_B64 =
  'MCowBQYDK2VwAyEAGsrjBoamWzFkq+IqD6gbPUv66IVLHvRmcmwyW+QkvDw=';

export interface LicensePayload {
  email: string;
  plan: 'annual' | 'monthly';
  validUntil: string;
  issuedAt: string;
}

export interface SaymdLicenseFile {
  email: string;
  plan: 'annual' | 'monthly';
  validUntil: string;
  key: string;
  signature: string;
}

function publicKey() {
  return createPublicKey({
    key: Buffer.from(LICENSE_PUBLIC_KEY_DER_B64, 'base64'),
    format: 'der',
    type: 'spki',
  });
}

export function signPayload(payload: LicensePayload, privateKeyDerB64: string): string {
  const priv = createPrivateKey({
    key: Buffer.from(privateKeyDerB64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  const data = Buffer.from(JSON.stringify(payload));
  return sign(null, data, priv).toString('base64');
}

export function parseLicenseKey(raw: string): SaymdLicenseFile {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed) as SaymdLicenseFile;
  }
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0) throw new Error('Invalid license format.');
  const payloadB64 = trimmed.slice(0, dot);
  const signature = trimmed.slice(dot + 1);
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as LicensePayload;
  return {
    email: payload.email,
    plan: payload.plan,
    validUntil: payload.validUntil,
    key: payloadB64,
    signature,
  };
}

export function verifyLicense(license: SaymdLicenseFile): boolean {
  try {
    if (new Date(license.validUntil).getTime() < Date.now()) return false;
    const payload = Buffer.from(license.key, 'base64url');
    const sig = Buffer.from(license.signature, 'base64');
    return verify(null, payload, publicKey(), sig);
  } catch {
    return false;
  }
}

export function createLicenseKey(payload: LicensePayload, privateKeyDerB64: string): string {
  const key = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signPayload(payload, privateKeyDerB64);
  return `${key}.${signature}`;
}
