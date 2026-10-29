import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { studentGroupSlots, students } from '@/lib/schema';

export async function validateSlotExclusions(classId: string, value: unknown, slotId?: string): Promise<string | null> {
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return 'Choose valid students from this class';
  const ids = [...new Set<string>(value)];
  if (!ids.length) return null;
  const rows = await db.select({ id: students.id }).from(students).where(and(eq(students.classId, classId), inArray(students.id, ids)));
  if (rows.length !== ids.length) return 'Every excluded student must belong to this class';
  if (slotId) {
    const members = await db.select({ id: studentGroupSlots.id }).from(studentGroupSlots).where(and(eq(studentGroupSlots.slotId, slotId), inArray(studentGroupSlots.studentId, ids))).limit(1);
    if (members.length) return 'Remove students from their groups in this slot before excluding them. Their existing project work will not be changed automatically.';
  }
  return null;
}
