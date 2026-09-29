import { findSimilarTitles } from '@/lib/title-duplicates';
import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const slotId = req.nextUrl.searchParams.get('slotId');
  const text = req.nextUrl.searchParams.get('text')?.trim();

  if (!slotId || !text || text.length < 5) {
    return NextResponse.json({ matches: [] });
  }

  const matches = await findSimilarTitles(session.classId, slotId, text);

  return NextResponse.json({ matches });
}
