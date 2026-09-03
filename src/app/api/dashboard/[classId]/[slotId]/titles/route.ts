import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { titles, students, studentGroupSlots } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, assertSlotInClass, jsonError } from '@/lib/helpers';
import { selectTitles, titleConditions } from '@/lib/titles-query';

export async function GET(
  req: NextRequest,
  { params }: { params: { classId: string; slotId: string } }
) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  const slot = await assertSlotInClass(params.slotId, params.classId);
  if (!slot) return jsonError('Slot not found', 404);

  const statusFilter = req.nextUrl.searchParams.get('status'); // 'pending' | 'verified' | 'rejected' | null (all)

  const rows = await selectTitles(
    titleConditions([
      eq(titles.classId, params.classId),
      eq(titles.slotId, params.slotId),
      statusFilter ? eq(titles.status, statusFilter) : undefined,
    ])
  );

  const withMembers = await Promise.all(
    rows.map(async (t) => {
      const members = await db
        .select({ id: students.id, name: students.name, idNumber: students.idNumber })
        .from(studentGroupSlots)
        .innerJoin(students, eq(students.id, studentGroupSlots.studentId))
        .where(eq(studentGroupSlots.groupId, t.groupId));
      return { ...t, members };
    })
  );

  return NextResponse.json({ titles: withMembers });
}
