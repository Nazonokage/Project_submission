import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { titles, students, studentGroupSlots, titleReports, professors } from '@/lib/schema';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
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

  const search = req.nextUrl.searchParams.get('q')?.trim();
  const rows = await selectTitles(
    titleConditions([
      eq(titles.classId, params.classId),
      eq(titles.slotId, params.slotId),
      statusFilter ? eq(titles.status, statusFilter) : undefined,
      search ? sql`(strpos(lower(${titles.text}), lower(${search})) > 0 OR strpos(lower(${titles.description}), lower(${search})) > 0)` : undefined,
    ])
  );

  const groupIds = Array.from(new Set(rows.map(t => t.groupId)));
  const studentIds = Array.from(new Set(rows.flatMap(t => t.submittedByStudentId ? [t.submittedByStudentId] : [])));
  const professorIds = Array.from(new Set(rows.flatMap(t => t.addedByProfId ? [t.addedByProfId] : [])));
  // Batch membership and authors independently: the submitter may have left the group.
  const [members, studentAuthors, professorAuthors] = await Promise.all([
    groupIds.length ? db.select({ groupId: studentGroupSlots.groupId, id: students.id, name: students.name, idNumber: students.idNumber })
      .from(studentGroupSlots).innerJoin(students, eq(students.id, studentGroupSlots.studentId))
      .where(and(inArray(studentGroupSlots.groupId, groupIds), eq(studentGroupSlots.slotId, params.slotId), eq(students.classId, params.classId))) : [],
    studentIds.length ? db.select({ id: students.id, name: students.name }).from(students)
      .where(and(inArray(students.id, studentIds), eq(students.classId, params.classId))) : [],
    professorIds.length ? db.select({ id: professors.id, name: professors.name }).from(professors)
      .where(inArray(professors.id, professorIds)) : [],
  ]);
  const byGroup = new Map<string, { id: string; name: string; idNumber: string }[]>();
  for (const { groupId, ...member } of members) {
    const list = byGroup.get(groupId) || [];
    list.push(member); byGroup.set(groupId, list);
  }
  const studentById = new Map(studentAuthors.map(author => [author.id, author]));
  const professorById = new Map(professorAuthors.map(author => [author.id, author]));
  const withMembers = rows.map(t => {
    const author = t.addedBy === 'prof' ? professorById.get(t.addedByProfId || '') : studentById.get(t.submittedByStudentId || '');
    return { ...t, members: (byGroup.get(t.groupId) || []).sort((a, b) => a.name.localeCompare(b.name)),
      submittedBy: author ? { ...author, role: t.addedBy === 'prof' ? 'prof' : 'student' } : null };
  });

  const latestByTitle = new Map<string, {
    version: string | null;
    progressSummary: string | null;
    changelog: string | null;
    repoUrl: string | null;
    deploymentUrl: string | null;
    extraLinks: string[] | null;
    createdAt: Date;
  }>();
  try {
    const ids = withMembers.map((t) => t.id);
    if (ids.length > 0) {
      const reports = await db
        .select({
          titleId: titleReports.titleId,
          version: titleReports.version,
          progressSummary: titleReports.progressSummary,
          changelog: titleReports.changelog,
          repoUrl: titleReports.repoUrl,
          deploymentUrl: titleReports.deploymentUrl,
          extraLinks: titleReports.extraLinks,
          createdAt: titleReports.createdAt,
        })
        .from(titleReports)
        .where(and(inArray(titleReports.titleId, ids), isNull(titleReports.deletedAt)))
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
