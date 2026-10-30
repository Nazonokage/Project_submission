import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createHmac } from 'node:crypto';
import { db } from './db';
import { students, professors } from './schema';
import { and, eq } from 'drizzle-orm';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Add it to .env.local');
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export const PROF_COOKIE = 'prof_token';
export const STUDENT_COOKIE = 'student_token';

export const sessionMaxAge = (rememberMe = false) => 60 * 60 * 24 * (rememberMe ? 7 : 1);

export type ProfPayload = { profId: string; email: string };
export type StudentPayload = { studentId: string; classId: string; credentialVersion: string };

export function studentCredentialVersion(passwordHash: string) {
  return createHmac('sha256', secret).update('student-credential-v1:' + passwordHash).digest('base64url');
}

// ---------- Prof session ----------

export async function signProfToken(payload: ProfPayload, rememberMe = false) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('professor-session')
    .setIssuedAt()
    .setExpirationTime(rememberMe ? '7d' : '1d')
    .sign(secret);
}

export async function verifyProfToken(token: string): Promise<ProfPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'], audience: 'professor-session' });
    if (typeof payload.profId !== 'string' || typeof payload.email !== 'string' || typeof payload.exp !== 'number') return null;
    return { profId: payload.profId, email: payload.email };
  } catch {
    return null;
  }
}

export async function setProfCookie(token: string, rememberMe = false) {
  const store = await cookies();
  store.set(PROF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionMaxAge(rememberMe),
  });
}

export async function clearProfCookie() {
  const store = await cookies();
  store.delete(PROF_COOKIE);
}

export async function getProfSession(): Promise<ProfPayload | null> {
  const store = await cookies();
  const token = store.get(PROF_COOKIE)?.value;
  if (!token) return null;
  const session = await verifyProfToken(token);
  if (!session) return null;
  const [prof] = await db.select({ id: professors.id }).from(professors)
    .where(and(eq(professors.id, session.profId), eq(professors.email, session.email))).limit(1);
  return prof ? session : null;
}

// ---------- Student session ----------

export async function signStudentToken(payload: StudentPayload, rememberMe = false) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('student-session')
    .setIssuedAt()
    .setExpirationTime(rememberMe ? '7d' : '1d')
    .sign(secret);
}

export async function verifyStudentToken(token: string): Promise<StudentPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'], audience: 'student-session' });
    if (typeof payload.studentId !== 'string' || typeof payload.classId !== 'string' || typeof payload.credentialVersion !== 'string' || typeof payload.exp !== 'number') return null;
    return { studentId: payload.studentId, classId: payload.classId, credentialVersion: payload.credentialVersion };
  } catch {
    return null;
  }
}

export async function setStudentCookie(token: string, rememberMe = false) {
  const store = await cookies();
  store.set(STUDENT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionMaxAge(rememberMe),
  });
}

export async function clearStudentCookie() {
  const store = await cookies();
  store.delete(STUDENT_COOKIE);
}

export async function getStudentSession(): Promise<StudentPayload | null> {
  const store = await cookies();
  const token = store.get(STUDENT_COOKIE)?.value;
  if (!token) return null;
  const session = await verifyStudentToken(token);
  if (!session) return null;
  const [student] = await db.select({ password: students.password }).from(students)
    .where(and(eq(students.id, session.studentId), eq(students.classId, session.classId), eq(students.isActive, true))).limit(1);
  return student && studentCredentialVersion(student.password) === session.credentialVersion ? session : null;
}
