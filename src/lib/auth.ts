import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Add it to .env.local');
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export const PROF_COOKIE = 'prof_token';
export const STUDENT_COOKIE = 'student_token';

export const sessionMaxAge = (rememberMe = false) => 60 * 60 * 24 * (rememberMe ? 7 : 1);

export type ProfPayload = { profId: string; email: string };
export type StudentPayload = { studentId: string; classId: string };

// ---------- Prof session ----------

export async function signProfToken(payload: ProfPayload, rememberMe = false) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(rememberMe ? '7d' : '1d')
    .sign(secret);
}

export async function verifyProfToken(token: string): Promise<ProfPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as ProfPayload;
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
  return verifyProfToken(token);
}

// ---------- Student session ----------

export async function signStudentToken(payload: StudentPayload, rememberMe = false) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(rememberMe ? '7d' : '1d')
    .sign(secret);
}

export async function verifyStudentToken(token: string): Promise<StudentPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as StudentPayload;
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
  return verifyStudentToken(token);
}
