import bcrypt from "bcryptjs";
import { decryptStudentPassword } from './password-vault.mjs';

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export async function verifyStoredPassword(plain: string, stored: string): Promise<boolean> {
  if (!/^\$2[aby]\$\d{2}\$/.test(stored)) return false;
  return verifyPassword(plain, stored);
}

export function passwordError(value: unknown): string | null {
  return typeof value !== 'string' || value.length < 12 || Buffer.byteLength(value, 'utf8') > 72
    ? 'Use a password of at least 12 characters and at most 72 UTF-8 bytes.' : null;
}

export function issuedPasswordError(value: unknown): string | null {
  return value === '2026' ? null : passwordError(value);
}

export async function recoverStudentPassword(student: { id: string; classId: string; password: string; passwordEncrypted?: string | null }, cls: { defaultStudentPassword?: string | null }): Promise<string | null> {
  if (student.passwordEncrypted) return decryptStudentPassword(student.passwordEncrypted, {
    classId: student.classId, studentId: student.id, passwordHash: student.password,
  });
  for (const candidate of new Set([cls.defaultStudentPassword, '2026'].filter(Boolean))) {
    if (candidate && await verifyStoredPassword(candidate, student.password)) return candidate;
  }
  return null;
}

export function publicStudent<T extends { password: string; passwordEncrypted?: string | null }>(student: T): Omit<T, 'password' | 'passwordEncrypted'> {
  const { password: _password, passwordEncrypted: _encrypted, ...safe } = student;
  return safe;
}
