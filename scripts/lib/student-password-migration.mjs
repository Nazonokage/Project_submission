import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

export async function prepareStudentPassword(row, { resetWeakPasswords = false } = {}) {
  const isHash = /^\$2[aby]\$\d{2}\$/.test(row.password);
  if (isHash && !resetWeakPasswords) return { kind: 'unchanged', password: row.password };
  let weak = !isHash && (row.password.length < 12 || Buffer.byteLength(row.password) > 72);
  if (resetWeakPasswords) {
    for (const value of new Set(['2026', row.default_student_password].filter(Boolean))) {
      if (isHash ? await bcrypt.compare(value, row.password) : value === row.password) weak = true;
    }
  }
  if (isHash && !weak) return { kind: 'unchanged', password: row.password };
  if (!resetWeakPasswords && Buffer.byteLength(row.password) > 72) {
    throw new Error('A legacy password exceeds the bcrypt byte limit. Reset that account before migrating.');
  }
  const reset = weak && resetWeakPasswords;
  const password = await bcrypt.hash(reset ? randomBytes(32).toString('base64url') : row.password, 12);
  if (!reset && !await bcrypt.compare(row.password, password)) throw new Error('Password preservation check failed');
  return { kind: reset ? 'reset' : 'hashed', password };
}
