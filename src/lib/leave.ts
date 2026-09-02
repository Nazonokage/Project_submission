import { db } from '@/lib/db';
import { groups, studentGroupSlots } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';

export async function applyApprovedLeave(groupId: string, studentId: string) {
  const [membership] = await db
    .select()
    .from(studentGroupSlots)
    .where(and(eq(studentGroupSlots.groupId, groupId), eq(studentGroupSlots.studentId, studentId)))
    .limit(1);

  if (membership) {
    await db.delete(studentGroupSlots).where(eq(studentGroupSlots.id, membership.id));
  }

  const remaining = await db
    .select()
    .from(studentGroupSlots)
    .where(eq(studentGroupSlots.groupId, groupId));

  if (remaining.length === 0) {
    await db.delete(groups).where(eq(groups.id, groupId));
    return { emptied: true as const, remaining: 0 };
  }

  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (group && remaining.length < group.maxSize && group.status === 'locked') {
    await db.update(groups).set({ status: 'forming' }).where(eq(groups.id, groupId));
  }

  return { emptied: false as const, remaining: remaining.length };
}
