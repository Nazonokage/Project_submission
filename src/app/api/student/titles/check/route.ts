import { findSimilarTitles } from '@/lib/title-duplicates';
import { NextRequest, NextResponse } from 'next/server';
import { getStudentSession } from '@/lib/auth';
import { assertSlotInClass, jsonError } from '@/lib/helpers';
import { isSlotParticipant } from '@/lib/slot-participation';

export async function GET(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const slotId = req.nextUrl.searchParams.get('slotId');
  const text = req.nextUrl.searchParams.get('text')?.trim();

  if (!slotId || !text || text.length < 5) {
    return NextResponse.json({ matches: [] });
  }

  const slot = await assertSlotInClass(slotId, session.classId);
  if (!slot) return jsonError('Slot not found', 404);
  if (!isSlotParticipant(slot, session.studentId)) return jsonError('You are not enrolled in this project slot', 403);
  const matches = await findSimilarTitles(session.classId, slotId, text);

  return NextResponse.json({ matches });
}
