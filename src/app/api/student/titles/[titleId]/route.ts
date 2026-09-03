import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { studentGroupSlots, titles } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';
import { isUndefinedColumn } from '@/lib/pg-errors';
import { isProgressStatus, type ProgressStatus } from '@/lib/progress';
import { logProgressChange } from '@/lib/project-updates';
import { selectTitleBy } from '@/lib/titles-query';

export async function PATCH(req: NextRequest, { params }: { params: { titleId: string } }) {
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
  const editingCopy =
    typeof body?.text === 'string' ||
    typeof body?.description === 'string' ||
    Array.isArray(body?.techStack) ||
    typeof body?.targetUsers === 'string';

  if (editingCopy && title.status === 'verified') {
    return jsonError('Verified titles cannot be edited', 409);
  }

  const patch: Record<string, unknown> = { updatedAt: new Date(), updatedByStudentId: session.studentId };
  if (typeof body?.text === 'string') patch.text = body.text.trim();
  if (typeof body?.description === 'string') patch.description = body.description.trim();
  if (Array.isArray(body?.techStack)) patch.techStack = body.techStack;
  if (typeof body?.targetUsers === 'string') patch.targetUsers = body.targetUsers.trim();

  let nextProgress: ProgressStatus | null = null;
  if (body?.progressStatus !== undefined) {
    if (!isProgressStatus(body.progressStatus)) {
      return jsonError('progressStatus must be planning, in_progress, review, or done', 422);
    }
    patch.progressStatus = body.progressStatus;
    nextProgress = body.progressStatus;
  }

  if (title.status === 'rejected' && editingCopy) {
    patch.status = 'pending';
    patch.rejectionReason = null;
  }

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
    return NextResponse.json({ title: row });
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
