/**
 * configure-r2-cors.mjs
 * Sets CORS rules on the R2 bucket so the browser can upload video chunks
 * directly to presigned R2 URLs and read back ETags.
 *
 * Usage:  node scripts/configure-r2-cors.mjs
 *
 * Reads R2 credentials from .env alongside this script.
 * Reads ALLOWED_STREAMING_DOMAINS to build the AllowedOrigins list.
 */

import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

const env = {};
try {
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
} catch (e) {
  console.error('Could not read .env:', e.message);
  process.exit(1);
}

const R2_ACCOUNT_ID = env.R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = env.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = env.R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || 'rankership';
const ALLOWED_STREAMING_DOMAINS = (env.ALLOWED_STREAMING_DOMAINS || process.env.ALLOWED_STREAMING_DOMAINS || '')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean);

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Missing R2 credentials in .env');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const allowedOrigins = [];
for (const host of ALLOWED_STREAMING_DOMAINS) {
  if (host === 'localhost') {
    allowedOrigins.push('http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175');
  } else {
    allowedOrigins.push(`https://${host}`);
  }
}

if (allowedOrigins.length === 0) {
  allowedOrigins.push('*');
  console.warn('No ALLOWED_STREAMING_DOMAINS set — using wildcard origin (not recommended for production).');
}

const corsRules = [
  {
    AllowedOrigins: allowedOrigins,
    AllowedMethods: ['PUT', 'GET'],
    AllowedHeaders: ['Content-Type', 'Content-Length'],
    ExposeHeaders: ['ETag'],
    MaxAgeSeconds: 3600,
  },
];

async function main() {
  console.log(`Bucket: ${R2_BUCKET_NAME}`);
  console.log(`Setting CORS with ${allowedOrigins.length} allowed origin(s):`);
  for (const o of allowedOrigins) console.log(`  - ${o}`);

  await s3.send(new PutBucketCorsCommand({
    Bucket: R2_BUCKET_NAME,
    CORSConfiguration: { CORSRules: corsRules },
  }));

  console.log('\nCORS rules applied. Verifying...');

  const result = await s3.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET_NAME }));
  console.log('Current CORS rules:', JSON.stringify(result.CORSRules, null, 2));
  console.log('\nDone.');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
