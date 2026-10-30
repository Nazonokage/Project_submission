// Dry-run by default. Does not print credentials, hashes, or connection strings.
import { readFileSync, existsSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { prepareStudentPassword } from './lib/student-password-migration.mjs';

const envFile = new URL('../.env.local', import.meta.url);
for (const line of (existsSync(envFile) ? readFileSync(envFile, 'utf8') : '').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
}
if (!process.env.DATABASE_URL_POOLED && !process.env.DATABASE_URL) throw new Error('Set DATABASE_URL_POOLED before running the credential migration');
const sql = neon(process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL);
const apply = process.argv.includes('--apply');
// Compatibility rollout: upgrade storage without invalidating current passwords.
const preserveExisting = !process.argv.includes('--reset-weak-passwords');
if (!preserveExisting && process.argv.includes('--preserve-existing-passwords')) throw new Error('Choose password preservation or explicit weak-password resets, not both');
const rows = await sql`SELECT s.id, s.password, c.default_student_password FROM students s JOIN classes c ON c.id = s.class_id`;
let hashed = 0, resets = 0, unchanged = 0, changedConcurrently = 0;
for (const row of rows) {
  const prepared = await prepareStudentPassword(row, { resetWeakPasswords: !preserveExisting });
  if (prepared.kind === 'unchanged') { unchanged++; continue; }
  const password = prepared.password;
  if (apply) {
    const changed = await sql`UPDATE students SET password = ${password} WHERE id = ${row.id} AND password = ${row.password} RETURNING id`;
    if (!changed.length) { changedConcurrently++; continue; }
  }
  if (prepared.kind === 'reset') resets++; else hashed++;
}
console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', preserveExistingPasswords: preserveExisting, hashed, requiresProfessorReset: resets, unchanged, changedConcurrently }));
if (!apply) console.log(hashed || resets
  ? 'Review these counts, then run again with --apply. Weak-password resets require the explicit --reset-weak-passwords option.'
  : 'No password storage changes are needed.');
