import { randomUUID } from 'node:crypto';
import { externalUrlError } from '@/lib/safe-url';
import { requireStudentTitleAccess } from '@/lib/student-title-access';
import { projectRequirementsError } from '@/lib/project-readiness';
import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLog, projectUpdates, studentGroupSlots, titleReports, titles } from '@/lib/schema';
import { and } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';
import { isSchemaDrift } from '@/lib/pg-errors';
import { assertActionRateLimit } from '@/lib/rate-limit';
import { selectTitleBy } from '@/lib/titles-query';

async function assertMembership(studentId: string, groupId: string) {
  const [membership] = await db
    .select()
    .from(studentGroupSlots)
    .where(and(eq(studentGroupSlots.studentId, studentId), eq(studentGroupSlots.groupId, groupId)))
    .limit(1);
  return membership ?? null;
}

export async function GET(_req: NextRequest, { params: promisedParams }: { params: Promise<{ titleId: string }> }) {
  const params = await promisedParams;
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const title = await selectTitleBy(and(eq(titles.id, params.titleId), eq(titles.classId, session.classId))!);
  if (!title) return jsonError('Title not found', 404);
  const accessError = await requireStudentTitleAccess(title, session);
  if (accessError) return accessError;
  const requiredInfo = projectRequirementsError(title);
  if (requiredInfo) return jsonError(requiredInfo, 428);

  try {
    const reports = await db
      .select()
      .from(titleReports)
      .where(eq(titleReports.titleId, title.id))
      .orderBy(desc(titleReports.createdAt));
    return NextResponse.json({ reports });
  } catch (err) {
    if (isSchemaDrift(err)) return NextResponse.json({ reports: [], schemaMissing: true });
    throw err;
  }
}

export async function POST(req: NextRequest, { params: promisedParams }: { params: Promise<{ titleId: string }> }) {
  const params = await promisedParams;
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const title = await selectTitleBy(and(eq(titles.id, params.titleId), eq(titles.classId, session.classId))!);
  if (!title) return jsonError('Title not found', 404);
  const accessError = await requireStudentTitleAccess(title, session);
  if (accessError) return accessError;
  const requiredInfo = projectRequirementsError(title);
  if (requiredInfo) return jsonError(requiredInfo, 428);
  if (title.status !== 'verified') return jsonError('Reports can only be submitted after a title is verified', 409);

  const membership = await assertMembership(session.studentId, title.groupId);
  if (!membership) return jsonError('Only group members can submit reports for this title', 403);

  const limited = await assertActionRateLimit({
    key: `student:${session.studentId}`,
    action: 'report_submit',
    max: 8,
    message: 'Too many report submissions. Wait a few minutes and try again.',
  });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  for (const field of ["repoUrl", "deploymentUrl"]) {
    const invalid = externalUrlError(body?.[field]);
    if (invalid) return jsonError(invalid, 422);
  }
  if (body?.extraLinks !== undefined && (!Array.isArray(body.extraLinks) || body.extraLinks.length > 20 || body.extraLinks.some((link: unknown) => !link || externalUrlError(link)))) return jsonError('Use at most 20 valid http(s) links', 422);
  const version = (body?.version as string | undefined)?.trim();
  const changelog = (body?.changelog as string | undefined)?.trim();
  const progressSummary = (body?.progressSummary as string | undefined)?.trim();
  const repoUrl = (body?.repoUrl as string | undefined)?.trim() || title.repoUrl;
  const deploymentUrl = (body?.deploymentUrl as string | undefined)?.trim() || title.deploymentUrl;
  const extraLinks = Array.isArray(body?.extraLinks)
    ? (body.extraLinks as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim())
    : [];

  if (!version || !changelog || !progressSummary) {
    return jsonError('version, changelog, and progress summary are required', 422);
  }

  try {
    const updateId = randomUUID();
    const reportId = randomUUID();
    const results = await db.batch([
      db.insert(projectUpdates).values({
        id: updateId, classId: title.classId, slotId: title.slotId, groupId: title.groupId,
        titleId: title.id, postedByStudentId: session.studentId, kind: 'milestone',
        headline: `Version Report / v${version}`, body: progressSummary, changelog,
      }),
      db.insert(titleReports).values({
        id: reportId, titleId: title.id, groupId: title.groupId, classId: title.classId,
        slotId: title.slotId, submittedByStudentId: session.studentId, repoUrl: repoUrl || null,
        deploymentUrl: deploymentUrl || null, version, changelog, progressSummary, extraLinks,
        projectUpdateId: updateId,
      }).returning(),
      db.insert(activityLog).values({ classId: title.classId, actorId: session.studentId, action: 'report.submitted', targetId: reportId }),
    ]);
    const row = results[1][0];

    const titlePatch: Record<string, unknown> = { updatedAt: new Date(), updatedByStudentId: session.studentId };
    if (repoUrl) titlePatch.repoUrl = repoUrl;
    if (deploymentUrl) titlePatch.deploymentUrl = deploymentUrl;
    await db.update(titles).set(titlePatch).where(eq(titles.id, title.id));

    return NextResponse.json({ report: row }, { status: 201 });
  } catch (err) {
    if (isSchemaDrift(err)) {
      return jsonError('Version reports are not available yet. Ask your professor to apply the latest schema.', 503);
    }
    throw err;
  }
}
