import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { groupInvites, groupLeaveRequests, groups, studentGroupSlots, titles } from '@/lib/schema';
import { and, eq, ne } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function POST(
  req: NextRequest,
  { params }: { params: { inviteId: string } }
) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const body = await req.json().catch(() => null);
  const action = body?.action as 'accept' | 'decline' | undefined;
  if (action !== 'accept' && action !== 'decline') {
    return jsonError('action must be "accept" or "decline"', 422);
  }

  const [invite] = await db
    .select()
    .from(groupInvites)
    .where(
      and(
        eq(groupInvites.id, params.inviteId),
        eq(groupInvites.invitedStudentId, session.studentId),
        eq(groupInvites.status, 'pending')
      )
    )
    .limit(1);
  if (!invite) return jsonError('Invite not found or already resolved', 404);

  if (action === 'decline') {
    await db.update(groupInvites).set({ status: 'declined' }).where(eq(groupInvites.id, invite.id));
    return NextResponse.json({ ok: true });
  }

  // A solo draft group may be merged into the inviting group. Multi-member and
  // verified groups are deliberately immovable.
  const [existingMembership] = await db
    .select()
    .from(studentGroupSlots)
    .where(
      and(eq(studentGroupSlots.studentId, session.studentId), eq(studentGroupSlots.slotId, invite.slotId))
    )
    .limit(1);
  const [group] = await db.select().from(groups).where(eq(groups.id, invite.groupId)).limit(1);
  if (!group) return jsonError('Group no longer exists', 404);
  if (group.status === 'locked') return jsonError('This group is already full', 409);

  const currentMembers = await db
    .select({ id: studentGroupSlots.id })
    .from(studentGroupSlots)
    .where(eq(studentGroupSlots.groupId, group.id));
  if (currentMembers.length >= group.maxSize) return jsonError('This group is already full', 409);

  if (existingMembership) {
    const oldMembers = await db.select({ id: studentGroupSlots.id })
      .from(studentGroupSlots).where(eq(studentGroupSlots.groupId, existingMembership.groupId));
    const [verifiedTitle] = await db.select({ id: titles.id }).from(titles).where(
      and(eq(titles.groupId, existingMembership.groupId), eq(titles.status, 'verified'))
    ).limit(1);
    const [pendingInvite] = await db.select({ id: groupInvites.id }).from(groupInvites).where(
      and(eq(groupInvites.groupId, existingMembership.groupId), eq(groupInvites.status, 'pending'))
    ).limit(1);
    const [pendingLeave] = await db.select({ id: groupLeaveRequests.id }).from(groupLeaveRequests).where(
      and(eq(groupLeaveRequests.groupId, existingMembership.groupId), eq(groupLeaveRequests.status, 'pending'))
    ).limit(1);
    if (oldMembers.length !== 1 || verifiedTitle || pendingInvite || pendingLeave) {
      return jsonError('You can only move from a solo draft group with no pending group changes', 409);
    }
  }

  // The Neon HTTP driver does not support interactive transactions. The checks
  // above run immediately before these ordered writes: move titles first so no
  // draft work is lost, then remove the old solo membership/group, then join.
  if (existingMembership) {
    await db.update(titles).set({ groupId: group.id, updatedAt: new Date() }).where(
      and(eq(titles.groupId, existingMembership.groupId), ne(titles.status, 'verified'))
    );
    await db.delete(studentGroupSlots).where(eq(studentGroupSlots.id, existingMembership.id));
    await db.delete(groups).where(eq(groups.id, existingMembership.groupId));
  }
  await db.insert(studentGroupSlots).values({
    studentId: session.studentId,
    groupId: group.id,
    slotId: invite.slotId,
  });

  await db.update(groupInvites).set({ status: 'accepted' }).where(eq(groupInvites.id, invite.id));

  // Auto-decline all other pending invites to this student for this slot
  await db
    .update(groupInvites)
    .set({ status: 'declined' })
    .where(
      and(
        eq(groupInvites.invitedStudentId, session.studentId),
        eq(groupInvites.slotId, invite.slotId),
        eq(groupInvites.status, 'pending'),
        ne(groupInvites.id, invite.id)
      )
    );

  // Lock the group if it's now full
  const memberCount = await db
    .select()
    .from(studentGroupSlots)
    .where(eq(studentGroupSlots.groupId, group.id));

  if (memberCount.length >= group.maxSize) {
    await db.update(groups).set({ status: 'locked' }).where(eq(groups.id, group.id));
  }

  return NextResponse.json({ ok: true, groupId: group.id });
}
