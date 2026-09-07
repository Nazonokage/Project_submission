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

const expectedTables = [
  'professors',
  'professor_otps',
  'classes',
  'students',
  'project_slots',
  'documentation_field_templates',
  'groups',
  'student_group_slots',
  'group_invites',
  'group_leave_requests',
  'titles',
  'tasks',
  'title_reports',
  'project_updates',
  'feedback',
  'activity_log',
  'rate_limits',
];

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
`;
const tableNames = new Set(tables.map((r) => r.table_name));

let ok = true;
console.log('--- Checking Public Tables (17 expected) ---');
for (const table of expectedTables) {
  const present = tableNames.has(table);
  console.log(`${present ? 'ok' : 'MISSING'}  ${table}`);
  if (!present) ok = false;
}

const checkColumns = async (table, cols) => {
  const res = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
  `;
  const set = new Set(res.map((r) => r.column_name));
  for (const col of cols) {
    const present = set.has(col);
    console.log(`${present ? 'ok' : 'MISSING'}  ${table}.${col}`);
    if (!present) ok = false;
  }
};

console.log('\n--- Checking Key Columns ---');
await checkColumns('titles', ['documentation', 'progress_status', 'last_commit_sha', 'last_commit_message', 'last_commit_at', 'updated_at', 'deleted_at']);
await checkColumns('tasks', ['title_id', 'group_id', 'class_id', 'slot_id', 'status', 'assignee_student_id', 'due_date', 'sort_order', 'deleted_at']);
await checkColumns('documentation_field_templates', ['slot_id', 'field_key', 'label', 'field_type', 'required', 'sort_order']);
await checkColumns('project_updates', ['task_id', 'changelog', 'updated_at', 'deleted_at']);
await checkColumns('title_reports', ['updated_at', 'deleted_at']);
await checkColumns('classes', ['updated_at']);
await checkColumns('project_slots', ['updated_at']);
await checkColumns('groups', ['updated_at']);

if (!ok) {
  console.error('\nSchema validation failed: missing tables or columns.');
  process.exit(1);
}
console.log('\nAll 17 tables and key columns verified cleanly.');
