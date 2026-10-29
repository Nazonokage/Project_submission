import { createHmac } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { ProfPayload } from '@/lib/auth';

export const PROF_REMEMBER_COOKIE = 'prof_remember_device';
export const PROF_REMEMBER_SECONDS = 60 * 60 * 24 * 7;

function rememberKey() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  // A remembered-device token must never work as a dashboard session token.
  return createHmac('sha256', process.env.JWT_SECRET).update('professor-remember-device-v1').digest();
}

export async function signRememberedProf(payload: ProfPayload) {
  return new SignJWT({ profId: payload.profId, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' }).setAudience('professor-remember-device')
    .setIssuedAt().setExpirationTime('7d').sign(rememberKey());
}

export async function verifyRememberedProf(token: string): Promise<ProfPayload | null> {
  try {
    const { payload } = await jwtVerify(token, rememberKey(), { algorithms: ['HS256'], audience: 'professor-remember-device' });
    if (typeof payload.profId !== 'string' || typeof payload.email !== 'string' || typeof payload.exp !== 'number') return null;
    return { profId: payload.profId, email: payload.email };
  } catch { return null; }
}

export async function getRememberedProf() {
  const store = await cookies();
  const token = store.get(PROF_REMEMBER_COOKIE)?.value;
  return token ? verifyRememberedProf(token) : null;
}

export async function rememberProf(payload: ProfPayload) {
  const token = await signRememberedProf(payload);
  const store = await cookies();
  store.set(PROF_REMEMBER_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/', maxAge: PROF_REMEMBER_SECONDS,
  });
}

export async function forgetProf() {
  const store = await cookies();
  store.delete(PROF_REMEMBER_COOKIE);
}
