import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { groupInvites, groups, groupLeaveRequests, studentGroupSlots, students } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { assertSlotInClass, jsonError } from '@/lib/helpers';
import { isSchemaDrift } from '@/lib/pg-errors';

// GET: returns this student's group for the given slot.
// If the slot is solo (groupSize === 1) and the student has no group yet,
// a solo group is auto-created and auto-joined.
export async function GET(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const slotId = req.nextUrl.searchParams.get('slotId');
  if (!slotId) return jsonError('slotId is required', 422);

  const slot = await assertSlotInClass(slotId, session.classId);
  if (!slot) return jsonError('Slot not found', 404);

  const [existing] = await db
    .select({ group: groups, membership: studentGroupSlots })
    .from(studentGroupSlots)
    .innerJoin(groups, eq(groups.id, studentGroupSlots.groupId))
    .where(and(eq(studentGroupSlots.studentId, session.studentId), eq(studentGroupSlots.slotId, slotId)))
    .limit(1);

  if (existing) {
    const members = await getGroupMembers(existing.group.id);
    // Keep groups created under an earlier slot setting in sync. In particular,
    // changing a slot from solo to pairs must re-open its one-person groups.
    const expectedStatus = members.length >= slot.groupSize ? 'locked' : 'forming';
    if (existing.group.maxSize !== slot.groupSize || existing.group.status !== expectedStatus) {
      const [group] = await db
        .update(groups)
        .set({ maxSize: slot.groupSize, status: expectedStatus })
        .where(eq(groups.id, existing.group.id))
        .returning();
      existing.group = group;
    }
    let leaveRequest = null;
    try {
      const [row] = await db
        .select()
        .from(groupLeaveRequests)
        .where(
          and(
            eq(groupLeaveRequests.groupId, existing.group.id),
            eq(groupLeaveRequests.studentId, session.studentId),
            eq(groupLeaveRequests.status, 'pending')
          )
        )
        .limit(1);
      leaveRequest = row ?? null;
    } catch (err) {
      if (!isSchemaDrift(err)) console.error('Could not load leave requests', err);
    }
    const pendingInvites = await db
      .select({ studentId: groupInvites.invitedStudentId })
      .from(groupInvites)
      .where(and(eq(groupInvites.groupId, existing.group.id), eq(groupInvites.status, 'pending')));
    return NextResponse.json({
      group: existing.group,
      members,
      leaveRequest,
      pendingInvitedStudentIds: pendingInvites.map((invite) => invite.studentId),
    });
  }

  if (slot.groupSize === 1) {
    const [group] = await db
      .insert(groups)
      .values({ classId: session.classId, slotId, status: 'locked', maxSize: 1 })
      .returning();

    await db.insert(studentGroupSlots).values({
      studentId: session.studentId,
      groupId: group.id,
      slotId,
    });

    const members = await getGroupMembers(group.id);
    return NextResponse.json({ group, members, leaveRequest: null, pendingInvitedStudentIds: [] });
  }

  return NextResponse.json({ group: null, members: [], leaveRequest: null, pendingInvitedStudentIds: [] });
}

// POST: create a new (multi-member) group for a slot and auto-join the creator.
export async function POST(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const body = await req.json().catch(() => null);
  const slotId = body?.slotId as string | undefined;
  if (!slotId) return jsonError('slotId is required', 422);

  const slot = await assertSlotInClass(slotId, session.classId);
  if (!slot) return jsonError('Slot not found', 404);

  // Already in a group for this slot?
  const [existing] = await db
    .select()
    .from(studentGroupSlots)
    .where(and(eq(studentGroupSlots.studentId, session.studentId), eq(studentGroupSlots.slotId, slotId)))
    .limit(1);
  if (existing) return jsonError('You already belong to a group for this project slot', 409);

  const [group] = await db
    .insert(groups)
    .values({
      classId: session.classId,
      slotId,
      status: slot.groupSize === 1 ? 'locked' : 'forming',
      maxSize: slot.groupSize,
    })
    .returning();

  await db.insert(studentGroupSlots).values({
    studentId: session.studentId,
    groupId: group.id,
    slotId,
  });

  const members = await getGroupMembers(group.id);
  return NextResponse.json({ group, members, leaveRequest: null, pendingInvitedStudentIds: [] }, { status: 201 });
}

async function getGroupMembers(groupId: string) {
  const rows = await db
    .select({ id: students.id, name: students.name, idNumber: students.idNumber })
    .from(studentGroupSlots)
    .innerJoin(students, eq(students.id, studentGroupSlots.studentId))
    .where(eq(studentGroupSlots.groupId, groupId));
  return rows;
}
