import { NextResponse } from 'next/server';
import { getTechTags } from '@/lib/tech-tags';
import { getStudentSession } from '@/lib/auth';
import { assertSlotInClass, jsonError } from '@/lib/helpers';

export async function GET(_req: Request, { params }: { params: { slotId: string } }) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);
  const slot = await assertSlotInClass(params.slotId, session.classId);
  if (!slot) return jsonError('Slot not found', 404);
  return NextResponse.json({ tags: await getTechTags(slot.classId, slot.id) });
}
