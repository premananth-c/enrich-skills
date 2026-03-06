/**
 * init-r2-storage.mjs
 * Verifies Cloudflare R2 credentials and creates the required top-level
 * folder placeholders inside the "rankership" bucket.
 *
 * R2/S3 has no real directories — folders are simulated by zero-byte
 * objects whose keys end with "/".
 *
 * Usage:  node scripts/init-r2-storage.mjs
 */

import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Load .env manually (no dotenv dependency needed)
// ---------------------------------------------------------------------------
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
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
} catch {
  console.error('Could not read .env file at', envPath);
  process.exit(1);
}

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME = 'rankership',
} = env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Missing one or more R2 credentials in .env (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Build S3 client pointing at R2
// ---------------------------------------------------------------------------
const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

console.log(`\nConnecting to Cloudflare R2`);
console.log(`  Endpoint : ${endpoint}`);
console.log(`  Bucket   : ${R2_BUCKET_NAME}`);
console.log(`  Key ID   : ${R2_ACCESS_KEY_ID.slice(0, 8)}…\n`);

const s3 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ---------------------------------------------------------------------------
// Step 1 — verify bucket access
// ---------------------------------------------------------------------------
console.log('Step 1 — verifying bucket access…');
try {
  await s3.send(new HeadBucketCommand({ Bucket: R2_BUCKET_NAME }));
  console.log(`  ✓ Bucket "${R2_BUCKET_NAME}" is accessible.\n`);
} catch (err) {
  console.error(`  ✗ Cannot access bucket "${R2_BUCKET_NAME}": ${err.message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 2 — list existing top-level prefixes
// ---------------------------------------------------------------------------
console.log('Step 2 — listing existing objects (top-level)…');
try {
  const list = await s3.send(
    new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, Delimiter: '/', MaxKeys: 50 })
  );
  const prefixes = (list.CommonPrefixes ?? []).map((p) => p.Prefix);
  const objects  = (list.Contents ?? []).map((o) => o.Key);
  if (prefixes.length === 0 && objects.length === 0) {
    console.log('  (bucket is empty)\n');
  } else {
    console.log('  Existing folders :', prefixes.length ? prefixes.join(', ') : '(none)');
    console.log('  Existing objects :', objects.length ? objects.join(', ') : '(none)');
    console.log();
  }
} catch (err) {
  console.warn(`  Warning: could not list objects — ${err.message}\n`);
}

// ---------------------------------------------------------------------------
// Step 3 — create folder placeholders
// ---------------------------------------------------------------------------
const folders = [
  'materials/',
  'videos/',
  'submissions/',
];

console.log('Step 3 — creating folder placeholders…');

let allOk = true;
for (const folder of folders) {
  process.stdout.write(`  PUT  ${folder}  …  `);
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: folder,
        Body: '',
        ContentType: 'application/x-directory',
      })
    );
    console.log('✓');
  } catch (err) {
    console.log(`✗  ${err.message}`);
    allOk = false;
  }
}

if (!allOk) {
  console.error('\nOne or more folders could not be created. Check your R2 token permissions.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 4 — confirm by re-listing
// ---------------------------------------------------------------------------
console.log('\nStep 4 — confirming folder structure…');
const list2 = await s3.send(
  new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, Delimiter: '/', MaxKeys: 50 })
);
const confirmed = (list2.CommonPrefixes ?? []).map((p) => p.Prefix);
for (const f of confirmed) {
  console.log(`  ✓ ${f}`);
}

console.log(`
Done! The following top-level folders now exist in bucket "${R2_BUCKET_NAME}":

  rankership/
  ├── materials/     ← PDFs, images, documents (course materials)
  ├── videos/        ← meeting recordings, batch video files
  └── submissions/   ← student activity submission uploads

Files will be stored with the pattern:
  materials/{tenantId}/{courseId}/{topicId}/{uuid}.{ext}
  videos/{tenantId}/{batchId}/{uuid}.{ext}
  submissions/{tenantId}/{activityId}/{userId}/{uuid}.{ext}
`);
