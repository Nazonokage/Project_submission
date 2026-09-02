import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, studentGroupSlots } from '@/lib/schema';
import { and, eq, notInArray } from 'drizzle-orm';
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

  const grouped = await db
    .select({ studentId: studentGroupSlots.studentId })
    .from(studentGroupSlots)
    .where(eq(studentGroupSlots.slotId, slotId));

  const groupedIds = grouped.map((g) => g.studentId);

  const rows = await db
    .select({ id: students.id, name: students.name, idNumber: students.idNumber })
    .from(students)
    .where(
      groupedIds.length > 0
        ? and(eq(students.classId, session.classId), notInArray(students.id, groupedIds))
        : eq(students.classId, session.classId)
    );

  return NextResponse.json({ students: rows });
}
