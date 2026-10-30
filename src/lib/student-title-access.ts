import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { studentGroupSlots } from './schema';
import { assertSlotInClass, jsonError } from './helpers';
import { isSlotParticipant } from './slot-participation';

export async function requireStudentTitleAccess(title: { groupId: string; slotId: string; classId: string }, session: { studentId: string; classId: string }) {
  if (title.classId !== session.classId) return jsonError('Project not found', 404);
  const slot = await assertSlotInClass(title.slotId, session.classId);
  if (!slot || !isSlotParticipant(slot, session.studentId)) return jsonError('Project not found', 404);
  const [member] = await db.select({ id: studentGroupSlots.id }).from(studentGroupSlots).where(and(
    eq(studentGroupSlots.studentId, session.studentId), eq(studentGroupSlots.groupId, title.groupId), eq(studentGroupSlots.slotId, title.slotId)
  )).limit(1);
  return member ? null : jsonError('Only group members can access project details', 403);
}
