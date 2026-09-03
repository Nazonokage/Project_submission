import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { titles } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, jsonError } from '@/lib/helpers';
import { isUndefinedColumn } from '@/lib/pg-errors';
import { isProgressStatus, type ProgressStatus } from '@/lib/progress';
import { logProgressChange } from '@/lib/project-updates';
import { selectTitleBy } from '@/lib/titles-query';

export async function PATCH(req: NextRequest, { params }: { params: { titleId: string } }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const title = await selectTitleBy(eq(titles.id, params.titleId));
  if (!title) return jsonError('Title not found', 404);

  const cls = await assertClassOwnedByProf(title.classId, prof.profId);
  if (!cls) return jsonError('Not authorized', 403);

  const body = await req.json().catch(() => null);
  if (!isProgressStatus(body?.progressStatus)) {
    return jsonError('progressStatus must be planning, in_progress, review, or done', 422);
  }

  const nextProgress: ProgressStatus = body.progressStatus;

  try {
    const [row] = await db
      .update(titles)
      .set({ progressStatus: nextProgress, updatedAt: new Date() })
      .where(eq(titles.id, title.id))
      .returning();

    if (nextProgress !== title.progressStatus) {
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
    if (isUndefinedColumn(err)) {
      return jsonError('Progress status columns are missing. Run add_pm_schema.sql on Neon.', 503);
    }
    throw err;
  }
}
