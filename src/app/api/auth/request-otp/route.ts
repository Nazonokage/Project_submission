import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { professorOtps } from '@/lib/schema';
import { generateOtp, jsonError } from '@/lib/helpers';
import { sendOtpEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = (body?.email as string | undefined)?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError('A valid email is required', 422);
  }

  const otp = generateOtp();

  await db.insert(professorOtps).values({ email, otp });

  try {
    await sendOtpEmail(email, otp);
  } catch (err) {
    console.error('Failed to send OTP email', err);
    return jsonError('Could not send the login email. Try again in a moment.', 502);
  }

  return NextResponse.json({ ok: true });
}
