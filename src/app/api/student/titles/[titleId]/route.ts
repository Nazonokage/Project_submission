import { requireStudentTitleAccess } from '@/lib/student-title-access';
import { consolidateDescription, missingDocumentationCount } from '@/lib/project-description';
import { projectRequirementsError, githubRepoUrlError, projectApprovalError } from '@/lib/project-readiness';
import { normalizeTechStack } from '@/lib/tech-stack';
import { duplicateGuard } from '@/lib/title-duplicates';
import { assertSlotInClass } from '@/lib/helpers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documentationFieldTemplates, studentGroupSlots, titles } from '@/lib/schema';
import { and, asc, eq } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';
import { isUndefinedColumn } from '@/lib/pg-errors';
import { isProgressStatus, type ProgressStatus } from '@/lib/progress';
import { logProgressChange } from '@/lib/project-updates';
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

  return NextResponse.json({ title, docFields: templates, missingRequiredCount });
}

export async function PATCH(req: NextRequest, { params: promisedParams }: { params: Promise<{ titleId: string }> }) {
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
  const editingCopy =
    typeof body?.text === 'string' ||
    typeof body?.description === 'string' ||
    Array.isArray(body?.techStack) ||
    typeof body?.targetUsers === 'string';

  const patch: Record<string, unknown> = { updatedAt: new Date(), updatedByStudentId: session.studentId };
  if (body && 'text' in body && typeof body.text !== 'string') return jsonError('Title text must be a string', 422);
  if (typeof body?.text === 'string') {
    const trimmedText = body.text.trim();
    if (trimmedText.length < 5) {
      return jsonError('Title text must be at least 5 characters long', 422);
    }
    if (trimmedText !== title.text) {
      const slot = await assertSlotInClass(title.slotId, session.classId);
      if (!slot) return jsonError('Slot not found', 404);
      const error = await duplicateGuard(title.classId, title.slotId, trimmedText, slot.duplicateCheck, body?.confirmDuplicate, title.id);
      if (error) return error;
    }
    patch.text = trimmedText;
  }
  if (body && 'description' in body) {
    if (typeof body.description !== 'string' || !body.description.trim()) return jsonError('Description / Abstract is required', 422);
    Object.assign(patch, consolidateDescription(title, body.description));
  }
  if (body && 'repoUrl' in body) {
    const repoError = githubRepoUrlError(body.repoUrl);
    if (repoError) return jsonError(repoError, 422);
    patch.repoUrl = body.repoUrl.trim();
  }
  if (Array.isArray(body?.techStack)) patch.techStack = normalizeTechStack(body.techStack);
  if (typeof body?.targetUsers === 'string') patch.targetUsers = body.targetUsers.trim();

  let nextProgress: ProgressStatus | null = null;
  if (body?.progressStatus !== undefined) {
    const approvalError = projectApprovalError(title);
    if (approvalError) return jsonError(approvalError, 403);
    const requiredInfo = projectRequirementsError({ ...title, ...patch });
    if (requiredInfo) return jsonError(requiredInfo, 428);
    if (!isProgressStatus(body.progressStatus)) {
      return jsonError('progressStatus must be planning, in_progress, review, or done', 422);
    }
    patch.progressStatus = body.progressStatus;
    nextProgress = body.progressStatus;
  }

  let missingRequiredCount: number | undefined;
  if (body?.documentation !== undefined) {
    const rawDoc = (body.documentation && typeof body.documentation === 'object' ? body.documentation : {}) as Record<string, unknown>;
    const templates = await db
      .select()
      .from(documentationFieldTemplates)
      .where(eq(documentationFieldTemplates.slotId, title.slotId))
      .orderBy(asc(documentationFieldTemplates.sortOrder));

    const consolidated = consolidateDescription(title, typeof patch.description === 'string' ? patch.description : undefined, rawDoc);
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

    Object.assign(patch, consolidated);
    missingRequiredCount = missingDocumentationCount(templates, consolidated);
  }

  if (title.status === 'rejected' && editingCopy) {
    patch.status = 'pending';
    patch.progressStatus = 'planning';
    patch.rejectionReason = null;
  }

  if (title.status !== 'verified') patch.progressStatus = 'planning';

  try {
    const [row] = await db.update(titles).set(patch).where(eq(titles.id, title.id)).returning();
    if (nextProgress && nextProgress !== title.progressStatus) {
      await logProgressChange({
        classId: title.classId,
        slotId: title.slotId,
        groupId: title.groupId,
        titleId: title.id,
        actorId: session.studentId,
        as: 'student',
        from: title.progressStatus,
        to: nextProgress,
      });
    }
    return NextResponse.json({ title: row, missingRequiredCount });
  } catch (err) {
    if (isUndefinedColumn(err) && nextProgress) {
      return jsonError(
        'Progress status is not available yet. Ask your professor to run the latest database migration.',
        503
      );
    }
    throw err;
  }
}

