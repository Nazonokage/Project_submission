import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { groupLeaveRequests, groups, projectSlots, students } from '@/lib/schema';
import { and, desc, eq } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, jsonError } from '@/lib/helpers';
import { isSchemaDrift } from '@/lib/pg-errors';

export async function GET(req: NextRequest, { params }: { params: { classId: string } }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  const status = req.nextUrl.searchParams.get('status') || 'pending';
  const slotId = req.nextUrl.searchParams.get('slotId');

  const filters = [eq(groupLeaveRequests.classId, params.classId)];
  if (status) filters.push(eq(groupLeaveRequests.status, status));
  if (slotId) filters.push(eq(groupLeaveRequests.slotId, slotId));

  try {
    const rows = await db
      .select({
        request: groupLeaveRequests,
        student: { id: students.id, name: students.name, idNumber: students.idNumber },
        slot: { id: projectSlots.id, label: projectSlots.label },
        group: { id: groups.id, status: groups.status, maxSize: groups.maxSize },
      })
      .from(groupLeaveRequests)
      .innerJoin(students, eq(students.id, groupLeaveRequests.studentId))
      .innerJoin(projectSlots, eq(projectSlots.id, groupLeaveRequests.slotId))
      .innerJoin(groups, eq(groups.id, groupLeaveRequests.groupId))
      .where(and(...filters))
      .orderBy(desc(groupLeaveRequests.createdAt));

    return NextResponse.json({
      schemaMissing: false,
      requests: rows.map((row) => ({
        id: row.request.id,
        status: row.request.status,
        reason: row.request.reason,
        createdAt: row.request.createdAt,
        student: row.student,
        slot: row.slot,
        group: row.group,
      })),
    });
  } catch (err) {
    if (isSchemaDrift(err)) {
      console.warn('group_leave_requests missing; run add_pm_schema.sql on Neon.');
      return NextResponse.json({ requests: [], schemaMissing: true });
    }
    console.error('Could not load leave requests', err);
    return jsonError('Could not load leave requests', 500);
  }
}
