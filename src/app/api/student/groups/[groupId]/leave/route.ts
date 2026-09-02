import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { activityLog, groupLeaveRequests, groups, studentGroupSlots } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function POST(req: NextRequest, { params }: { params: { groupId: string } }) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, params.groupId), eq(groups.classId, session.classId)))
    .limit(1);
  if (!group) return jsonError('Group not found', 404);

  const [membership] = await db
    .select()
    .from(studentGroupSlots)
    .where(and(eq(studentGroupSlots.groupId, group.id), eq(studentGroupSlots.studentId, session.studentId)))
    .limit(1);
  if (!membership) return jsonError('You are not a member of this group', 403);

  const [existing] = await db
    .select()
    .from(groupLeaveRequests)
    .where(
      and(
        eq(groupLeaveRequests.groupId, group.id),
        eq(groupLeaveRequests.studentId, session.studentId),
        eq(groupLeaveRequests.status, 'pending')
      )
    )
    .limit(1);
  if (existing) {
    return jsonError('Your leave request is already waiting for professor confirmation', 409);
  }

  const body = await req.json().catch(() => null);
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '';

  const [row] = await db
    .insert(groupLeaveRequests)
    .values({
      groupId: group.id,
      classId: session.classId,
      slotId: group.slotId,
      studentId: session.studentId,
      reason: reason || null,
    })
    .returning();

  await db.insert(activityLog).values({
    classId: session.classId,
    actorId: session.studentId,
    action: 'group.leave_requested',
    targetId: row.id,
  });

  return NextResponse.json({ leaveRequest: row }, { status: 201 });
}

export async function DELETE(_req: NextRequest, { params }: { params: { groupId: string } }) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, params.groupId), eq(groups.classId, session.classId)))
    .limit(1);
  if (!group) return jsonError('Group not found', 404);

  const [existing] = await db
    .select()
    .from(groupLeaveRequests)
    .where(
      and(
        eq(groupLeaveRequests.groupId, group.id),
        eq(groupLeaveRequests.studentId, session.studentId),
        eq(groupLeaveRequests.status, 'pending')
      )
    )
    .limit(1);
  if (!existing) return jsonError('No pending leave request to cancel', 404);

  await db
    .update(groupLeaveRequests)
    .set({ status: 'cancelled', resolvedAt: new Date() })
    .where(eq(groupLeaveRequests.id, existing.id));

  return NextResponse.json({ ok: true });
}
