import { requireStudentTitleAccess } from '@/lib/student-title-access';
import { consolidateDescription, missingDocumentationCount, projectDescription } from '@/lib/project-description';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documentationFieldTemplates, studentGroupSlots, titles } from '@/lib/schema';
import { and, asc, eq } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';
import { selectTitleBy } from '@/lib/titles-query';

export async function GET(_req: NextRequest, { params: promisedParams }: { params: Promise<{ titleId: string }> }) {
  const params = await promisedParams;
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const title = await selectTitleBy(and(eq(titles.id, params.titleId), eq(titles.classId, session.classId))!);
  if (!title) return jsonError('Title not found', 404);
  const accessError = await requireStudentTitleAccess(title, session);
  if (accessError) return accessError;

  const templates = await db
    .select()
    .from(documentationFieldTemplates)
    .where(eq(documentationFieldTemplates.slotId, title.slotId))
    .orderBy(asc(documentationFieldTemplates.sortOrder));

  const missingRequiredCount = missingDocumentationCount(templates, title);

  return NextResponse.json({
    description: projectDescription(title),
    documentation: consolidateDescription(title).documentation,
    docFields: templates,
    missingRequiredCount,
  });
}

export async function POST(req: NextRequest, { params: promisedParams }: { params: Promise<{ titleId: string }> }) {
  const params = await promisedParams;
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const title = await selectTitleBy(and(eq(titles.id, params.titleId), eq(titles.classId, session.classId))!);
  if (!title) return jsonError('Title not found', 404);
  const accessError = await requireStudentTitleAccess(title, session);
  if (accessError) return accessError;

  const [membership] = await db
    .select()
    .from(studentGroupSlots)
    .where(
      and(eq(studentGroupSlots.studentId, session.studentId), eq(studentGroupSlots.groupId, title.groupId))
    )
    .limit(1);
  if (!membership) return jsonError("You are not a member of this title's group", 403);

  const body = await req.json().catch(() => null);
  const rawDoc = (body?.documentation && typeof body.documentation === 'object'
    ? body.documentation
    : typeof body === 'object' && body !== null && !('documentation' in body)
    ? body
    : {}) as Record<string, unknown>;

  const templates = await db
    .select()
    .from(documentationFieldTemplates)
    .where(eq(documentationFieldTemplates.slotId, title.slotId))
    .orderBy(asc(documentationFieldTemplates.sortOrder));

  if (body && 'description' in body && (typeof body.description !== 'string' || !body.description.trim())) return jsonError('Description / Abstract is required', 422);
  const consolidated = consolidateDescription(title, typeof body?.description === 'string' ? body.description : undefined, rawDoc);
  const normalizedDoc = consolidated.documentation;

  for (const t of templates) {
    if (t.fieldKey === 'abstract') continue;
    const val = rawDoc[t.fieldKey];
    if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
      normalizedDoc[t.fieldKey] = null;
    } else if (typeof val === 'string') {
      normalizedDoc[t.fieldKey] = val.trim();
    } else {
      normalizedDoc[t.fieldKey] = val;
    }
  }

  const missingRequiredCount = missingDocumentationCount(templates, consolidated);
  const [updated] = await db
    .update(titles)
    .set({
      ...consolidated,
      updatedAt: new Date(),
      updatedByStudentId: session.studentId,
    })
    .where(eq(titles.id, title.id))
    .returning();

  return NextResponse.json({
    description: updated.description,
    documentation: updated.documentation,
    missingRequiredCount,
    title: updated,
  });
}
