import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { students, studentGroupSlots } from './schema';
import { isUuid, jsonError } from './helpers';

export async function assertTaskAssignee(value: unknown, groupId: string, slotId: string, classId: string) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !isUuid(value)) return jsonError('Choose a group member as assignee', 422);
  const [member] = await db.select({ id: students.id }).from(studentGroupSlots)
    .innerJoin(students, eq(students.id, studentGroupSlots.studentId))
    .where(and(eq(studentGroupSlots.studentId, value), eq(studentGroupSlots.groupId, groupId), eq(studentGroupSlots.slotId, slotId), eq(students.classId, classId), eq(students.isActive, true))).limit(1);
  return member ? null : jsonError('Assignee must be an active member of this project group', 422);
}
