import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projectUpdates, students, titleReports, titles, groups } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, jsonError } from '@/lib/helpers';

// GET /api/prof/updates?titleId=... OR ?groupId=...
// Returns ALL updates including soft-deleted so the prof can see the full history.
export async function GET(req: NextRequest) {
  const session = await getProfSession();
  if (!session) return jsonError('Not authenticated', 401);

  const { searchParams } = new URL(req.url);
  const titleId = searchParams.get('titleId');
  const groupId = searchParams.get('groupId');

  if (!titleId && !groupId) return jsonError('titleId or groupId is required', 400);

  const [resource] = titleId
    ? await db.select({ classId: titles.classId }).from(titles).where(eq(titles.id, titleId)).limit(1)
    : await db.select({ classId: groups.classId }).from(groups).where(eq(groups.id, groupId!)).limit(1);
  if (!resource) return jsonError('Project not found', 404);
  if (!await assertClassOwnedByProf(resource.classId, session.profId)) return jsonError('Forbidden', 403);

  // Build the where clause
  const conditions = [];
  if (titleId) conditions.push(eq(projectUpdates.titleId, titleId));
  if (groupId) conditions.push(eq(projectUpdates.groupId, groupId));

  const updates = await db
    .select({
      id: projectUpdates.id,
      titleId: projectUpdates.titleId,
      groupId: projectUpdates.groupId,
      kind: projectUpdates.kind,
      headline: projectUpdates.headline,
      body: projectUpdates.body,
      changelog: projectUpdates.changelog,
      commitSha: projectUpdates.commitSha,
      commitUrl: projectUpdates.commitUrl,
      postedByStudentId: projectUpdates.postedByStudentId,
      postedByProfId: projectUpdates.postedByProfId,
      createdAt: projectUpdates.createdAt,
      updatedAt: projectUpdates.updatedAt,
      deletedAt: projectUpdates.deletedAt,
      report: {
        id: titleReports.id,
        version: titleReports.version,
        progressSummary: titleReports.progressSummary,
        changelog: titleReports.changelog,
        repoUrl: titleReports.repoUrl,
        deploymentUrl: titleReports.deploymentUrl,
      },
      // Join student name for display
      studentName: students.name,
    })
    .from(projectUpdates)
    .leftJoin(students, eq(students.id, projectUpdates.postedByStudentId))
    .leftJoin(titleReports, eq(titleReports.projectUpdateId, projectUpdates.id))
    .where(and(...conditions))
    .orderBy(desc(projectUpdates.createdAt));

  return NextResponse.json({ updates });
}
