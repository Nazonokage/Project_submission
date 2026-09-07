import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { groupInvites, groupLeaveRequests, groups, students, studentGroupSlots, titles } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { assertSlotInClass, jsonError } from '@/lib/helpers';

export async function GET(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const slotId = req.nextUrl.searchParams.get('slotId');
  if (!slotId) return jsonError('slotId is required', 422);

  const slot = await assertSlotInClass(slotId, session.classId);
  if (!slot) return jsonError('Slot not found', 404);

  if (slot.groupSize === 1) {
    // No concept of "without a group" for solo slots — everyone gets auto-assigned.
    return NextResponse.json({ students: [] });
  }

  const [classmates, memberships, verifiedTitles, pendingInvites, pendingLeaves] = await Promise.all([
    db.select({ id: students.id, name: students.name, idNumber: students.idNumber })
      .from(students)
      .where(eq(students.classId, session.classId)),
    db.select({ studentId: studentGroupSlots.studentId, groupId: studentGroupSlots.groupId })
    .from(studentGroupSlots)
      .innerJoin(groups, eq(groups.id, studentGroupSlots.groupId))
      .where(and(eq(studentGroupSlots.slotId, slotId), eq(groups.classId, session.classId))),
    db.select({ groupId: titles.groupId })
      .from(titles)
      .where(and(eq(titles.slotId, slotId), eq(titles.classId, session.classId), eq(titles.status, 'verified'))),
    db.select({ groupId: groupInvites.groupId }).from(groupInvites)
      .where(and(eq(groupInvites.slotId, slotId), eq(groupInvites.status, 'pending'))),
    db.select({ groupId: groupLeaveRequests.groupId }).from(groupLeaveRequests)
      .where(and(eq(groupLeaveRequests.slotId, slotId), eq(groupLeaveRequests.status, 'pending'))),
  ]);

  const memberCount = new Map<string, number>();
  const groupForStudent = new Map<string, string>();
  for (const membership of memberships) {
    memberCount.set(membership.groupId, (memberCount.get(membership.groupId) || 0) + 1);
    groupForStudent.set(membership.studentId, membership.groupId);
  }
  const verifiedGroups = new Set(verifiedTitles.map((title) => title.groupId));
  const changingGroups = new Set([
    ...pendingInvites.map((invite) => invite.groupId),
    ...pendingLeaves.map((request) => request.groupId),
  ]);

  // A classmate is eligible if they are ungrouped, or are the sole member of a
  // draft-only group. The latter supports moving solo work into a new pair/team.
  const rows = classmates.filter((student) => {
    if (student.id === session.studentId) return false;
    const groupId = groupForStudent.get(student.id);
    return !groupId || (
      memberCount.get(groupId) === 1 &&
      !verifiedGroups.has(groupId) &&
      !changingGroups.has(groupId)
    );
  });

  return NextResponse.json({ students: rows });
}
