import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { titles } from '@/lib/schema';
import { and, eq, ilike } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const slotId = req.nextUrl.searchParams.get('slotId');
  const text = req.nextUrl.searchParams.get('text')?.trim();

  if (!slotId || !text || text.length < 3) {
    return NextResponse.json({ matches: [] });
  }

  const matches = await db
    .select({ id: titles.id, text: titles.text, status: titles.status })
    .from(titles)
    .where(and(eq(titles.classId, session.classId), eq(titles.slotId, slotId), ilike(titles.text, `%${text}%`)))
    .limit(5);

  return NextResponse.json({ matches });
}
