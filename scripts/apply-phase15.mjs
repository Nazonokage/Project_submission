import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env.local');

for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const i = trimmed.indexOf('=');
  if (i < 1) continue;
  const key = trimmed.slice(0, i).trim();
  let value = trimmed.slice(i + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = value;
}

const url = process.env.DATABASE_URL || process.env.DATABASE_URL_POOLED;
if (!url) {
  console.error('DATABASE_URL or DATABASE_URL_POOLED is missing in .env.local');
  process.exit(1);
}

const sql = neon(url);

try {
  console.log('Adding instructions column to project_slots...');
  await sql`ALTER TABLE project_slots ADD COLUMN IF NOT EXISTS instructions text;`;
  console.log('Adding archived_at column to classes...');
  await sql`ALTER TABLE classes ADD COLUMN IF NOT EXISTS archived_at timestamptz;`;
  console.log('Phase 15 migration applied cleanly.');
} catch (err) {
  console.error('Phase 15 migration failed:', err);
  process.exit(1);
}
