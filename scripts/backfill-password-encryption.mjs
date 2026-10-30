// Only recover known issued passwords that match their hashes. Never reset or log them.
import { existsSync, readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { encryptStudentPassword, decryptStudentPassword } from '../src/lib/password-vault.mjs';
const envFile = new URL('../.env.local', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);
const sql = neon(process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL);
const apply = process.argv.includes('--apply');
const rows = await sql`SELECT s.id,s.class_id,s.password,s.password_encrypted,c.default_student_password FROM students s JOIN classes c ON c.id=s.class_id`;
let encrypted = 0, unchanged = 0, unavailable = 0, changedConcurrently = 0;
for (const row of rows) {
  const context = { studentId: row.id, classId: row.class_id, passwordHash: row.password };
  if (row.password_encrypted) { decryptStudentPassword(row.password_encrypted, context); unchanged++; continue; }
  let original;
  for (const candidate of new Set([row.default_student_password, '2026'].filter(Boolean))) {
    if (await bcrypt.compare(candidate, row.password)) { original = candidate; break; }
  }
  if (!original) { unavailable++; continue; }
  const ciphertext = encryptStudentPassword(original, context);
  if (decryptStudentPassword(ciphertext, context) !== original) throw new Error('Encryption verification failed');
  if (apply) {
    const changed = await sql`UPDATE students SET password_encrypted=${ciphertext} WHERE id=${row.id} AND password=${row.password} AND password_encrypted IS NULL RETURNING id`;
    if (!changed.length) { changedConcurrently++; continue; }
  }
  encrypted++;
}
console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', encrypted, unchanged, unavailable, changedConcurrently }));
