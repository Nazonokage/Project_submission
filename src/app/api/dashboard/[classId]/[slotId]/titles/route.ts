import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { titles, students, studentGroupSlots, titleReports } from '@/lib/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, assertSlotInClass, jsonError } from '@/lib/helpers';
import { isSchemaDrift } from '@/lib/pg-errors';
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

  const latestByTitle = new Map<string, { version: string | null; progressSummary: string | null; createdAt: Date }>();
  try {
    const ids = withMembers.map((t) => t.id);
    if (ids.length > 0) {
      const reports = await db
        .select({
          titleId: titleReports.titleId,
          version: titleReports.version,
          progressSummary: titleReports.progressSummary,
          createdAt: titleReports.createdAt,
        })
        .from(titleReports)
        .where(inArray(titleReports.titleId, ids))
        .orderBy(desc(titleReports.createdAt));
      for (const r of reports) {
        if (!latestByTitle.has(r.titleId)) latestByTitle.set(r.titleId, r);
      }
    }
  } catch (err) {
    if (!isSchemaDrift(err)) throw err;
  }

  return NextResponse.json({
    titles: withMembers.map((t) => ({
      ...t,
      latestReport: latestByTitle.get(t.id) || null,
    })),
  });
}
