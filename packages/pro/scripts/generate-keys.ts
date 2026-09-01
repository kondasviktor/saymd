#!/usr/bin/env node
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const priv = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');

const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
writeFileSync(join(dir, 'keys.example.env'), `SAYMD_LICENSE_PRIVATE_KEY_DER_B64=${priv}\n# Public key goes in src/license.ts:\n# ${pub}\n`);

console.log('Wrote keys.example.env — embed public key in license.ts, private key in Vercel env only.');
