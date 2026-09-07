import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documentationFieldTemplates, studentGroupSlots, titles } from '@/lib/schema';
import { and, asc, eq } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';
import { selectTitleBy } from '@/lib/titles-query';

export async function GET(_req: NextRequest, { params }: { params: { titleId: string } }) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const title = await selectTitleBy(and(eq(titles.id, params.titleId), eq(titles.classId, session.classId))!);
  if (!title) return jsonError('Title not found', 404);

  const templates = await db
    .select()
    .from(documentationFieldTemplates)
    .where(eq(documentationFieldTemplates.slotId, title.slotId))
    .orderBy(asc(documentationFieldTemplates.sortOrder));

  const doc = (title.documentation as Record<string, unknown> | null) || {};
  let missingRequiredCount = 0;
  for (const t of templates) {
    if (t.required) {
      const val = doc[t.fieldKey];
      if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
        missingRequiredCount++;
      }
    }
  }

  return NextResponse.json({
    documentation: title.documentation || {},
    docFields: templates,
    missingRequiredCount,
  });
}

export async function POST(req: NextRequest, { params }: { params: { titleId: string } }) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const title = await selectTitleBy(and(eq(titles.id, params.titleId), eq(titles.classId, session.classId))!);
  if (!title) return jsonError('Title not found', 404);

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

  const normalizedDoc: Record<string, unknown> = { ...rawDoc };
  let missingRequiredCount = 0;

  for (const t of templates) {
    const val = rawDoc[t.fieldKey];
    if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
      normalizedDoc[t.fieldKey] = null;
      if (t.required) missingRequiredCount++;
    } else if (typeof val === 'string') {
      normalizedDoc[t.fieldKey] = val.trim();
    } else {
      normalizedDoc[t.fieldKey] = val;
    }
  }

  const [updated] = await db
    .update(titles)
    .set({
      documentation: normalizedDoc,
      updatedAt: new Date(),
      updatedByStudentId: session.studentId,
    })
    .where(eq(titles.id, title.id))
    .returning();

  return NextResponse.json({
    documentation: updated.documentation,
    missingRequiredCount,
    title: updated,
  });
}
