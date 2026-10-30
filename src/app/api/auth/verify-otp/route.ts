import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { professorOtps, professors } from '@/lib/schema';
import { and, eq, gt } from 'drizzle-orm';
import { otpDigest, validEmail } from '@/lib/otp';
import { assertActionRateLimit } from '@/lib/rate-limit';
import { cleanupProfessorOtps, jsonError } from '@/lib/helpers';
import { signProfToken, setProfCookie } from '@/lib/auth';
import { rememberProf, forgetProf } from '@/lib/prof-remember';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const otp = typeof body?.otp === 'string' ? body.otp.trim() : '';

  if (!validEmail(email) || !/^\d{6}$/.test(otp)) {
    return jsonError('A valid email and six-digit code are required', 422);
  }
  const message = 'Too many code attempts. Request another code in 15 minutes.';
  const globalLimit = await assertActionRateLimit({ key: 'otp-verification-service', action: 'otp_verify', max: 1000, message });
  if (globalLimit) return globalLimit;
  const limited = await assertActionRateLimit({ key: email, action: 'otp_verify', max: 5, message });
  if (limited) return limited;

  const [record] = await db
    .update(professorOtps)
    .set({ used: true })
    .where(
      and(
        eq(professorOtps.email, email),
        eq(professorOtps.otp, otpDigest(email, otp)),
        eq(professorOtps.used, false),
        gt(professorOtps.expiresAt, new Date())
      )
    )
    .returning();

  if (!record) {
    return jsonError('That code is invalid or has expired', 401);
  }

  try {
    await cleanupProfessorOtps();
  } catch (err) {
    console.error('Failed to clean up professor OTPs', err);
  }

  // Upsert professor
  const [prof] = await db.insert(professors).values({ email, name: email.split('@')[0] })
    .onConflictDoUpdate({ target: professors.email, set: { lastLoginAt: new Date() } }).returning();

  const token = await signProfToken({ profId: prof.id, email: prof.email }, body?.rememberMe === true);
  await setProfCookie(token, body?.rememberMe === true);
  if (body?.rememberMe === true) await rememberProf({ profId: prof.id, email: prof.email });
  else await forgetProf();

  return NextResponse.json({ ok: true, prof: { id: prof.id, email: prof.email, name: prof.name } });
}
