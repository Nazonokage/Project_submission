import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLog, groups, projectUpdates, studentGroupSlots, titles } from '@/lib/schema';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const { searchParams } = new URL(req.url);
  const titleId = searchParams.get('titleId');
  if (!titleId) return jsonError('titleId is required', 400);

  const [title] = await db
    .select()
    .from(titles)
    .where(and(eq(titles.id, titleId), eq(titles.classId, session.classId)))
    .limit(1);
  if (!title) return jsonError('Title not found', 404);

  const updates = await db
    .select()
    .from(projectUpdates)
    .where(and(eq(projectUpdates.titleId, titleId), isNull(projectUpdates.deletedAt)))
    .orderBy(desc(projectUpdates.createdAt));

  return NextResponse.json({ updates });
}

export async function POST(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const body = await req.json().catch(() => null);
  const titleId = body?.titleId as string | undefined;
  const headline = (body?.headline as string | undefined)?.trim();
  const updateBody = (body?.body as string | undefined)?.trim();
  const kind = (body?.kind as string | undefined) ?? 'progress';
  const changelog = (body?.changelog as string | undefined)?.trim() || null;
  const commitSha = (body?.commitSha as string | undefined)?.trim() || null;
  const commitUrl = (body?.commitUrl as string | undefined)?.trim() || null;

  if (!titleId) return jsonError('titleId is required', 400);
  if (!headline) return jsonError('headline is required', 400);
  if (!updateBody) return jsonError('body is required', 400);
  if (!['progress', 'commit', 'milestone', 'note'].includes(kind)) {
    return jsonError('kind must be progress, commit, milestone, or note', 422);
  }

  const [title] = await db
    .select()
    .from(titles)
    .where(and(eq(titles.id, titleId), eq(titles.classId, session.classId)))
    .limit(1);
  if (!title) return jsonError('Title not found', 404);
  if (title.status !== 'verified') return jsonError('Updates can only be posted for verified titles', 409);

  const [membership] = await db
    .select()
    .from(studentGroupSlots)
    .where(
      and(
        eq(studentGroupSlots.studentId, session.studentId),
        eq(studentGroupSlots.groupId, title.groupId)
      )
    )
    .limit(1);
  if (!membership) return jsonError('Only group members can post updates for this title', 403);

  const [group] = await db.select().from(groups).where(eq(groups.id, title.groupId)).limit(1);
  if (!group) return jsonError('Group not found', 404);

  const [update] = await db
    .insert(projectUpdates)
    .values({
      classId: title.classId,
      slotId: title.slotId,
      groupId: title.groupId,
      titleId: title.id,
      postedByStudentId: session.studentId,
      kind,
      headline,
      body: updateBody,
      changelog,
      commitSha,
      commitUrl,
    })
    .returning();

  await db.insert(activityLog).values({
    classId: title.classId,
    actorId: session.studentId,
    action: 'update.posted',
    targetId: update.id,
  }).catch(() => {});

  return NextResponse.json({ update }, { status: 201 });
}
