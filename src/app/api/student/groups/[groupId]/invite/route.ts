import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { groupInvites, groupLeaveRequests, groups, studentGroupSlots, titles } from '@/lib/schema';
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

  const members = await db
    .select({ id: studentGroupSlots.id })
    .from(studentGroupSlots)
    .where(eq(studentGroupSlots.groupId, group.id));
  if (members.length >= group.maxSize) return jsonError('This group is already full', 409);

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

  // Invitees can migrate only from a solo group with no verified title. This
  // lets draft work move into a pair/team without allowing established groups
  // to be split or approved work to be reassigned.
  const [existingMembership] = await db
    .select()
    .from(studentGroupSlots)
    .where(
      and(eq(studentGroupSlots.studentId, invitedStudentId), eq(studentGroupSlots.slotId, group.slotId))
    )
    .limit(1);
  if (existingMembership) {
    const existingMembers = await db.select({ id: studentGroupSlots.id })
      .from(studentGroupSlots).where(eq(studentGroupSlots.groupId, existingMembership.groupId));
    const [verifiedTitle] = await db.select({ id: titles.id }).from(titles).where(
      and(eq(titles.groupId, existingMembership.groupId), eq(titles.status, 'verified'))
    ).limit(1);
    const [pendingChange] = await db.select({ id: groupInvites.id }).from(groupInvites).where(
      and(eq(groupInvites.groupId, existingMembership.groupId), eq(groupInvites.status, 'pending'))
    ).limit(1);
    const [pendingLeave] = await db.select({ id: groupLeaveRequests.id }).from(groupLeaveRequests).where(
      and(eq(groupLeaveRequests.groupId, existingMembership.groupId), eq(groupLeaveRequests.status, 'pending'))
    ).limit(1);
    if (existingMembers.length !== 1 || verifiedTitle || pendingChange || pendingLeave) {
      return jsonError('That student is already in an established or approved project group', 409);
    }
  }

  const [pendingInvite] = await db
    .select({ id: groupInvites.id })
    .from(groupInvites)
    .where(
      and(
        eq(groupInvites.groupId, group.id),
        eq(groupInvites.invitedStudentId, invitedStudentId),
        eq(groupInvites.status, 'pending')
      )
    )
    .limit(1);
  if (pendingInvite) return jsonError('This student already has a pending invitation', 409);

  const pendingInvites = await db
    .select({ id: groupInvites.id })
    .from(groupInvites)
    .where(and(eq(groupInvites.groupId, group.id), eq(groupInvites.status, 'pending')));
  if (members.length + pendingInvites.length >= group.maxSize) {
    return jsonError('All remaining group seats already have pending invitations', 409);
  }

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
