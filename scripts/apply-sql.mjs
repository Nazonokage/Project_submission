import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env.local');
const sqlPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(root, 'add_pm_schema.sql');

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
const file = readFileSync(sqlPath, 'utf8');
const statements = file
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const stmt of statements) {
  await sql(stmt);
}
console.log(`Applied ${sqlPath}`);

