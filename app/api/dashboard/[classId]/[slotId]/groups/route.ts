import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { groups, students, studentGroupSlots } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, assertSlotInClass, jsonError } from '@/lib/helpers';

export async function GET(
  _req: NextRequest,
  { params }: { params: { classId: string; slotId: string } }
) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  const slot = await assertSlotInClass(params.slotId, params.classId);
  if (!slot) return jsonError('Slot not found', 404);

  const rows = await db
    .select()
    .from(groups)
    .where(and(eq(groups.classId, params.classId), eq(groups.slotId, params.slotId)));

  const withMembers = await Promise.all(
    rows.map(async (g) => {
      const members = await db
        .select({ id: students.id, name: students.name, idNumber: students.idNumber })
        .from(studentGroupSlots)
        .innerJoin(students, eq(students.id, studentGroupSlots.studentId))
        .where(eq(studentGroupSlots.groupId, g.id));
      return { ...g, members };
    })
  );

  return NextResponse.json({ groups: withMembers });
}
