// AES-256-GCM helpers for encrypting per-tenant secrets at rest.
//
// Used to wrap:
//   - Per-tenant Postgres connection strings stored in
//     `TenantDbConfig.connectionUrlEnc` (control-plane DB).
//   - Razorpay/Stripe `secret_key` and `webhook_secret` stored in
//     `TenantPaymentCredential.secretKeyEnc` / `webhookSecretEnc`.
//
// Master key is read from `TENANT_SECRETS_KEY` (32 random bytes encoded
// as base64). Generate one for a new environment with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// Ciphertext format (base64):
//   <12-byte IV> || <16-byte auth tag> || <ciphertext>
// All concatenated as one buffer, then base64-encoded.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.TENANT_SECRETS_KEY;
  if (!raw) {
    throw new Error(
      'TENANT_SECRETS_KEY is not set. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `TENANT_SECRETS_KEY must decode to ${KEY_BYTES} bytes (got ${buf.length}). It must be a base64-encoded 32-byte key.`
    );
  }
  cachedKey = buf;
  return buf;
}

/**
 * Encrypt a UTF-8 plaintext string. Returns base64(iv || tag || ciphertext).
 * Throws if `TENANT_SECRETS_KEY` is missing or malformed.
 */
export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * Decrypt a value produced by {@link encryptSecret}. Throws if the input is
 * malformed, the key is wrong, or the auth tag does not verify.
 */
export function decryptSecret(payload: string): string {
  const key = loadKey();
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('Encrypted payload is too short to be valid');
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return out.toString('utf8');
}

/**
 * Validate that the master key is loadable. Call at API boot so misconfiguration
 * fails fast instead of at the first encrypt/decrypt.
 */
export function assertSecretsKeyLoaded(): void {
  loadKey();
}
