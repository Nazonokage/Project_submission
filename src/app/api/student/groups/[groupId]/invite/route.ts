import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { groupInvites, groups, studentGroupSlots } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { assertStudentInClass, jsonError } from '@/lib/helpers';

export async function POST(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const body = await req.json().catch(() => null);
  const invitedStudentId = body?.studentId as string | undefined;
  if (!invitedStudentId) return jsonError('studentId is required', 422);

  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, params.groupId), eq(groups.classId, session.classId)))
    .limit(1);
  if (!group) return jsonError('Group not found', 404);
  if (group.status === 'locked') return jsonError('This group is already locked', 409);

  // Inviter must be a member of the group
  const [membership] = await db
    .select()
    .from(studentGroupSlots)
    .where(
      and(eq(studentGroupSlots.groupId, group.id), eq(studentGroupSlots.studentId, session.studentId))
    )
    .limit(1);
  if (!membership) return jsonError('You are not a member of this group', 403);

  const invitee = await assertStudentInClass(invitedStudentId, session.classId);
  if (!invitee) return jsonError('Student not found in this class', 404);

  // Invitee must not already be in a group for this slot
  const [alreadyGrouped] = await db
    .select()
    .from(studentGroupSlots)
    .where(
      and(eq(studentGroupSlots.studentId, invitedStudentId), eq(studentGroupSlots.slotId, group.slotId))
    )
    .limit(1);
  if (alreadyGrouped) return jsonError('That student already belongs to a group for this slot', 409);

  const [invite] = await db
    .insert(groupInvites)
    .values({
      groupId: group.id,
      classId: session.classId,
      slotId: group.slotId,
      invitedStudentId,
      invitedByStudentId: session.studentId,
    })
    .returning();

  return NextResponse.json({ invite }, { status: 201 });
}
