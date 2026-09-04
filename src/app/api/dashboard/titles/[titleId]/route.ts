import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { activityLog, titles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, jsonError } from '@/lib/helpers';
import { isUndefinedColumn } from '@/lib/pg-errors';
import { isProgressStatus, type ProgressStatus } from '@/lib/progress';
import { logProgressChange } from '@/lib/project-updates';
import { selectTitleBy } from '@/lib/titles-query';

const TITLE_STATUSES = ['pending', 'verified', 'rejected'] as const;
type TitleStatus = (typeof TITLE_STATUSES)[number];

function isTitleStatus(value: unknown): value is TitleStatus {
  return typeof value === 'string' && (TITLE_STATUSES as readonly string[]).includes(value);
}

function optionalTrimmed(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.trim();
}

export async function PATCH(req: NextRequest, { params }: { params: { titleId: string } }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const title = await selectTitleBy(eq(titles.id, params.titleId));
  if (!title) return jsonError('Title not found', 404);

  const cls = await assertClassOwnedByProf(title.classId, prof.profId);
  if (!cls) return jsonError('Not authorized', 403);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return jsonError('Invalid JSON body', 422);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  const text = optionalTrimmed(body.text);
  const description = optionalTrimmed(body.description);
  const targetUsers = optionalTrimmed(body.targetUsers);
  const repoUrl = optionalTrimmed(body.repoUrl);
  const deploymentUrl = optionalTrimmed(body.deploymentUrl);
  const rejectionReason = optionalTrimmed(body.rejectionReason);

  if (text !== undefined) {
    if (!text) return jsonError('text cannot be empty', 422);
    patch.text = text;
  }
  if (description !== undefined) {
    if (!description) return jsonError('description cannot be empty', 422);
    patch.description = description;
  }
  if (Array.isArray(body.techStack)) {
    patch.techStack = body.techStack.filter((tag: unknown) => typeof tag === 'string' && tag.trim()).map((tag: string) => tag.trim());
  }
  if (targetUsers !== undefined) patch.targetUsers = targetUsers || null;
  if (repoUrl !== undefined) patch.repoUrl = repoUrl || null;
  if (deploymentUrl !== undefined) patch.deploymentUrl = deploymentUrl || null;

  let nextStatus: TitleStatus | undefined;
  if (body.status !== undefined) {
    if (!isTitleStatus(body.status)) {
      return jsonError('status must be pending, verified, or rejected', 422);
    }
    nextStatus = body.status;
    patch.status = nextStatus;
    if (nextStatus === 'verified') {
      patch.verifiedAt = title.verifiedAt ?? new Date();
      patch.rejectionReason = null;
    } else if (nextStatus === 'rejected') {
      patch.verifiedAt = null;
      if (rejectionReason !== undefined) patch.rejectionReason = rejectionReason || null;
    } else {
      patch.verifiedAt = null;
      patch.rejectionReason = null;
    }
  } else if (rejectionReason !== undefined) {
    patch.rejectionReason = rejectionReason || null;
  }

  let nextProgress: ProgressStatus | null = null;
  if (body.progressStatus !== undefined) {
    if (!isProgressStatus(body.progressStatus)) {
      return jsonError('progressStatus must be planning, in_progress, review, or done', 422);
    }
    patch.progressStatus = body.progressStatus;
    nextProgress = body.progressStatus;
  }

  const keys = Object.keys(patch).filter((k) => k !== 'updatedAt');
  if (keys.length === 0) return jsonError('No fields to update', 422);

  try {
    const [row] = await db.update(titles).set(patch).where(eq(titles.id, title.id)).returning();

    const editedFields = keys.filter((k) => k !== 'progressStatus');
    if (editedFields.length > 0) {
      try {
        await db.insert(activityLog).values({
          classId: title.classId,
          actorId: prof.profId,
          action: 'title.edited',
          targetId: title.id,
        });
      } catch (err) {
        console.error('Could not write activity log', err);
      }
    }

    if (nextProgress && nextProgress !== title.progressStatus) {
      await logProgressChange({
        classId: title.classId,
        slotId: title.slotId,
        groupId: title.groupId,
        titleId: title.id,
        actorId: prof.profId,
        as: 'prof',
        from: title.progressStatus,
        to: nextProgress,
      });
    }

    return NextResponse.json({ title: row });
  } catch (err) {
    if (isUndefinedColumn(err) && nextProgress) {
      return jsonError('Progress status columns are missing. Run add_pm_schema.sql on Neon.', 503);
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { titleId: string } }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const title = await selectTitleBy(eq(titles.id, params.titleId));
  if (!title) return jsonError('Title not found', 404);

  const cls = await assertClassOwnedByProf(title.classId, prof.profId);
  if (!cls) return jsonError('Not authorized', 403);

  try {
    await db.insert(activityLog).values({
      classId: title.classId,
      actorId: prof.profId,
      action: 'title.deleted',
      targetId: title.id,
    });
  } catch (err) {
    console.error('Could not write activity log', err);
  }

  try {
    await db.update(titles).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(titles.id, title.id));
  } catch (err) {
    if (isUndefinedColumn(err)) {
      await db.delete(titles).where(eq(titles.id, title.id));
    } else {
      throw err;
    }
  }
  return NextResponse.json({ ok: true });
}
