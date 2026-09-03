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

const expectedColumns = [
  'progress_status',
  'last_commit_sha',
  'last_commit_message',
  'last_commit_at',
];
const expectedTables = ['group_leave_requests', 'project_updates'];

const cols = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'titles'
`;
const colNames = new Set(cols.map((r) => r.column_name));

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
`;
const tableNames = new Set(tables.map((r) => r.table_name));

let ok = true;
for (const col of expectedColumns) {
  const present = colNames.has(col);
  console.log(`${present ? 'ok' : 'MISSING'}  titles.${col}`);
  if (!present) ok = false;
}
for (const table of expectedTables) {
  const present = tableNames.has(table);
  console.log(`${present ? 'ok' : 'MISSING'}  ${table}`);
  if (!present) ok = false;
}

if (!ok) {
  console.error('\nRun: node scripts/apply-sql.mjs add_pm_schema.sql');
  process.exit(1);
}
console.log('\nPM schema looks complete.');
