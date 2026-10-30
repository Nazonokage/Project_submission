import { assertActionRateLimit } from '@/lib/rate-limit';
import { externalUrlError } from '@/lib/safe-url';
import { requireStudentTitleAccess } from '@/lib/student-title-access';
import { projectRequirementsError, projectApprovalError } from '@/lib/project-readiness';
import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLog, groups, projectUpdates, studentGroupSlots, titleReports, titles } from '@/lib/schema';
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
    .where(and(eq(titles.id, titleId), eq(titles.classId, session.classId), isNull(titles.deletedAt)))
    .limit(1);
  if (!title) return jsonError('Title not found', 404);
  const accessError = await requireStudentTitleAccess(title, session);
  if (accessError) return accessError;
  const approvalError = projectApprovalError(title);
  if (approvalError) return jsonError(approvalError, 403);
  const requiredInfo = projectRequirementsError(title);
  if (requiredInfo) return jsonError(requiredInfo, 428);

  const rows = await db
    .select({
      update: projectUpdates,
      report: {
        id: titleReports.id,
        version: titleReports.version,
        progressSummary: titleReports.progressSummary,
        changelog: titleReports.changelog,
        repoUrl: titleReports.repoUrl,
        deploymentUrl: titleReports.deploymentUrl,
        extraLinks: titleReports.extraLinks,
      },
    })
    .from(projectUpdates)
    .leftJoin(titleReports, eq(titleReports.projectUpdateId, projectUpdates.id))
    .where(and(eq(projectUpdates.titleId, titleId), isNull(projectUpdates.deletedAt)))
    .orderBy(desc(projectUpdates.createdAt));

  const updates = rows.map(({ update, report }) => ({
    ...update,
    report: report?.id ? report : null,
  }));
  return NextResponse.json({ updates });
}

export async function POST(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const body = await req.json().catch(() => null);
  const limited = await assertActionRateLimit({ key: session.studentId, action: 'project_write', max: 60, message: 'Too many updates. Try again later.' });
  if (limited) return limited;
  if ((typeof body?.headline === 'string' && body.headline.length > 20000) || (typeof body?.body === 'string' && body.body.length > 20000) || (typeof body?.changelog === 'string' && body.changelog.length > 20000)) return jsonError('Text is too long (maximum 20,000 characters)', 422);
  for (const field of ["commitUrl"]) {
    const invalid = externalUrlError(body?.[field]);
    if (invalid) return jsonError(invalid, 422);
  }
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
    .where(and(eq(titles.id, titleId), eq(titles.classId, session.classId), isNull(titles.deletedAt)))
    .limit(1);
  if (!title) return jsonError('Title not found', 404);
  const accessError = await requireStudentTitleAccess(title, session);
  if (accessError) return accessError;
  const approvalError = projectApprovalError(title);
  if (approvalError) return jsonError(approvalError, 403);
  const requiredInfo = projectRequirementsError(title);
  if (requiredInfo) return jsonError(requiredInfo, 428);

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
