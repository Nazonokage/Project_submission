import { NextResponse } from 'next/server';
import { getTechTags } from '@/lib/tech-tags';
import { getStudentSession } from '@/lib/auth';
import { assertSlotInClass, jsonError } from '@/lib/helpers';
import { isSlotParticipant } from '@/lib/slot-participation';

export async function GET(_req: Request, { params }: { params: { slotId: string } }) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);
  const slot = await assertSlotInClass(params.slotId, session.classId);
  if (!slot) return jsonError('Slot not found', 404);
  if (!isSlotParticipant(slot, session.studentId)) return jsonError('You are not enrolled in this project slot', 403);
  return NextResponse.json({ tags: await getTechTags(slot.classId, slot.id) });
}
