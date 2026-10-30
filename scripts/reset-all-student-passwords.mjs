import { existsSync, readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { encryptStudentPassword, decryptStudentPassword } from '../src/lib/password-vault.mjs';

const envFile = new URL('../.env.local', import.meta.url);
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const connectionString = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Database connection string (DATABASE_URL_POOLED or DATABASE_URL) is not defined');
}

const sql = neon(connectionString);
const apply = process.argv.includes('--apply');

console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);

// Ensure password_encrypted column exists
if (apply) {
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS password_encrypted text;`;
  await sql`UPDATE classes SET default_student_password = '2026' WHERE default_student_password IS DISTINCT FROM '2026';`;
}

const rows = await sql`SELECT id, class_id, name, id_number FROM students ORDER BY name ASC`;
console.log(`Found ${rows.length} students to reset to '2026'.`);

if (!apply) {
  console.log('Run again with --apply to execute the database update.');
  process.exit(0);
}

const hash = await bcrypt.hash('2026', 12);
let updated = 0;

for (const student of rows) {
  const context = { studentId: student.id, classId: student.class_id, passwordHash: hash };
  const encrypted = encryptStudentPassword('2026', context);
  const decrypted = decryptStudentPassword(encrypted, context);
  if (decrypted !== '2026') {
    throw new Error(`Encryption verification failed for student ${student.id}`);
  }

  await sql`
    UPDATE students 
    SET password = ${hash}, password_encrypted = ${encrypted}
    WHERE id = ${student.id}
  `;
  updated++;
}

// Clear any student login rate limits so no student is locked out
try {
  await sql`DELETE FROM rate_limits WHERE action = 'student_login';`;
  console.log('Cleared student login rate limits.');
} catch {
  // If rate_limits table does not exist or fails, proceed
}

console.log(`Successfully reset passwords for ${updated} students to '2026'.`);
