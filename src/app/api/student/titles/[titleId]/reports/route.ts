import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documentationFieldTemplates, studentGroupSlots, titleReports, titles } from '@/lib/schema';
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

export async function GET(_req: NextRequest, { params }: { params: { titleId: string } }) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const title = await selectTitleBy(and(eq(titles.id, params.titleId), eq(titles.classId, session.classId))!);
  if (!title) return jsonError('Title not found', 404);

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

export async function POST(req: NextRequest, { params }: { params: { titleId: string } }) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const title = await selectTitleBy(and(eq(titles.id, params.titleId), eq(titles.classId, session.classId))!);
  if (!title) return jsonError('Title not found', 404);
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
  const version = (body?.version as string | undefined)?.trim();
  const changelog = (body?.changelog as string | undefined)?.trim();
  const progressSummary = (body?.progressSummary as string | undefined)?.trim();
  const repoUrl = (body?.repoUrl as string | undefined)?.trim() || title.repoUrl;
  const deploymentUrl = (body?.deploymentUrl as string | undefined)?.trim() || title.deploymentUrl;
  const extraLinks = Array.isArray(body?.extraLinks)
    ? (body.extraLinks as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim())
    : [];
  const documentation = (body?.documentation as Record<string, unknown> | undefined) || null;

  if (!version || !changelog || !progressSummary) {
    return jsonError('version, changelog, and progress summary are required', 422);
  }

  // Validate required doc fields from templates
  const templates = await db
    .select()
    .from(documentationFieldTemplates)
    .where(and(eq(documentationFieldTemplates.slotId, title.slotId), eq(documentationFieldTemplates.required, true)));

  for (const t of templates) {
    const val = documentation ? documentation[t.fieldKey] : undefined;
    if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
      return jsonError(`Documentation field "${t.label}" is required`, 422);
    }
  }

  try {
    const [row] = await db
      .insert(titleReports)
      .values({
        titleId: title.id,
        groupId: title.groupId,
        classId: title.classId,
        slotId: title.slotId,
        submittedByStudentId: session.studentId,
        repoUrl: repoUrl || null,
        deploymentUrl: deploymentUrl || null,
        version,
        changelog,
        progressSummary,
        extraLinks,
        documentation,
      })
      .returning();

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
