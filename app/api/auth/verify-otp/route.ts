import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { professorOtps, professors } from '@/lib/schema';
import { and, desc, eq, gt } from 'drizzle-orm';
import { jsonError } from '@/lib/helpers';
import { signProfToken, setProfCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const otp = (body?.otp as string | undefined)?.trim();

  if (!email || !otp) {
    return jsonError('Email and code are required', 422);
  }

  const [record] = await db
    .select()
    .from(professorOtps)
    .where(
      and(
        eq(professorOtps.email, email),
        eq(professorOtps.otp, otp),
        eq(professorOtps.used, false),
        gt(professorOtps.expiresAt, new Date())
      )
    )
    .orderBy(desc(professorOtps.createdAt))
    .limit(1);

  if (!record) {
    return jsonError('That code is invalid or has expired', 401);
  }

  await db.update(professorOtps).set({ used: true }).where(eq(professorOtps.id, record.id));

  // Upsert professor
  let [prof] = await db.select().from(professors).where(eq(professors.email, email)).limit(1);
  if (!prof) {
    const nameGuess = email.split('@')[0];
    [prof] = await db
      .insert(professors)
      .values({ email, name: nameGuess })
      .returning();
  }

  const token = await signProfToken({ profId: prof.id, email: prof.email });
  await setProfCookie(token);

  return NextResponse.json({ ok: true, prof: { id: prof.id, email: prof.email, name: prof.name } });
}
