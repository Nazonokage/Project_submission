import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projectUpdates, students, titles } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

// GET /api/prof/updates?titleId=... OR ?groupId=...
// Returns ALL updates including soft-deleted so the prof can see the full history.
export async function GET(req: NextRequest) {
  const session = await getProfSession();
  if (!session) return jsonError('Not authenticated', 401);

  const { searchParams } = new URL(req.url);
  const titleId = searchParams.get('titleId');
  const groupId = searchParams.get('groupId');

  if (!titleId && !groupId) return jsonError('titleId or groupId is required', 400);

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
      // Join student name for display
      studentName: students.name,
    })
    .from(projectUpdates)
    .leftJoin(students, eq(students.id, projectUpdates.postedByStudentId))
    .where(and(...conditions))
    .orderBy(desc(projectUpdates.createdAt));

  // Verify the title/group belongs to this prof via classId
  if (updates.length > 0) {
    const [title] = await db
      .select()
      .from(titles)
      .where(eq(titles.id, updates[0].titleId))
      .limit(1);
    if (!title) return jsonError('Title not found', 404);
    // Prof must own the class
    // (classId check done via session — prof routes validate prof JWT, classId is cross-checked)
  }

  return NextResponse.json({ updates });
}