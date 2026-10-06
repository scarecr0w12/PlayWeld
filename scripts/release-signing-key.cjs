// SPDX-License-Identifier: Apache-2.0
const { generateKeyPairSync, createPrivateKey, createHash } = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { dpapi } = require('../packages/platform-service/lib/engines/unreal/editor-bridge-tools');

async function readProtectedSigningKey(file) {
  const bytes = await dpapi(readFileSync(path.resolve(file)), true, new AbortController().signal);
  try { return createPrivateKey({ key: bytes, format: 'der', type: 'pkcs8' }); }
  finally { bytes.fill(0); }
}
async function generate(directory) {
  if (process.platform !== 'win32') throw new Error('Local protected release-key generation requires Windows DPAPI. CI can continue using its configured secret.');
  directory = path.resolve(directory);
  const privateFile = path.join(directory, 'release-private.dpapi');
  const publicFile = path.join(directory, 'release-public.pem');
  if ([privateFile, publicFile, path.join(directory, 'key.json')].some(existsSync)) throw new Error('Signing key files already exist; existing keys are never overwritten.');
  const keys = generateKeyPairSync('ed25519');
  const bytes = keys.privateKey.export({ format: 'der', type: 'pkcs8' });
  let encrypted;
  try { encrypted = await dpapi(bytes, false, new AbortController().signal); }
  finally { bytes.fill(0); }
  const publicKey = keys.publicKey.export({ format: 'pem', type: 'spki' });
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(privateFile, encrypted, { flag: 'wx', mode: 0o600 });
  writeFileSync(publicFile, publicKey, { flag: 'wx', mode: 0o644 });
  const record = { schemaVersion: 1, algorithm: 'ed25519', protection: 'windows-dpapi-current-user', publicKeySha256: createHash('sha256').update(publicKey).digest('hex'), generatedAt: new Date().toISOString(), privateFile: path.basename(privateFile), publicFile: path.basename(publicFile), purpose: 'Release metadata verification; not a Windows Authenticode certificate.' };
  writeFileSync(path.join(directory, 'key.json'), JSON.stringify(record, null, 2), { flag: 'wx', mode: 0o600 });
  return record;
}
module.exports = { generate, readProtectedSigningKey };
if (require.main === module) {
  if (!process.argv[2]) { console.error('Usage: node scripts/release-signing-key.cjs <private local directory>'); process.exitCode = 1; }
  else generate(process.argv[2]).then(record => console.log(JSON.stringify(record))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
