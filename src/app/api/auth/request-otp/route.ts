import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { professorOtps, professors } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getProfSession, setProfCookie, signProfToken } from '@/lib/auth';
import { getRememberedProf } from '@/lib/prof-remember';
import { cleanupProfessorOtps, generateOtp, jsonError } from '@/lib/helpers';
import { sendOtpEmail } from '@/lib/mailer';
import { assertOtpRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError('A valid email is required', 422);
  }

  const remembered = await getRememberedProf();
  const session = await getProfSession();
  const identity = remembered?.email === email ? remembered : session?.email === email ? session : null;
  if (identity) {
    const [prof] = await db.select().from(professors).where(and(eq(professors.id, identity.profId), eq(professors.email, email))).limit(1);
    if (prof) {
      await setProfCookie(await signProfToken({ profId: prof.id, email: prof.email }, remembered?.email === email), remembered?.email === email);
      return NextResponse.json({ ok: true, authenticated: true });
    }
  }

  const limited = await assertOtpRateLimit(email);
  if (limited) return limited;

  const otp = generateOtp();

  await db.insert(professorOtps).values({ email, otp });
  try {
    await cleanupProfessorOtps();
  } catch (err) {
    console.error('Failed to clean up professor OTPs', err);
  }

  try {
    await sendOtpEmail(email, otp);
  } catch (err) {
    console.error('Failed to send OTP email', err);
    return jsonError('Could not send the login email. Try again in a moment.', 502);
  }

  return NextResponse.json({ ok: true });
}
