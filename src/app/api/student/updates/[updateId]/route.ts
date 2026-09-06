import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLog, projectUpdates, studentGroupSlots } from '@/lib/schema';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

async function resolveUpdate(updateId: string, studentId: string, classId: string) {
  const [update] = await db
    .select()
    .from(projectUpdates)
    .where(eq(projectUpdates.id, updateId))
    .limit(1);
  if (!update) return { update: null, error: jsonError('Update not found', 404) };
  if (update.classId !== classId) return { update: null, error: jsonError('Not authorized', 403) };
  if (update.deletedAt) return { update: null, error: jsonError('Update has been deleted', 410) };
  if (update.postedByStudentId !== studentId) {
    return { update: null, error: jsonError('You can only modify your own updates', 403) };
  }
  const [membership] = await db
    .select()
    .from(studentGroupSlots)
    .where(and(eq(studentGroupSlots.studentId, studentId), eq(studentGroupSlots.groupId, update.groupId)))
    .limit(1);
  if (!membership) return { update: null, error: jsonError('You are no longer a member of this group', 403) };
  return { update, error: null };
}

export async function PATCH(req: NextRequest, { params }: { params: { updateId: string } }) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const { update, error } = await resolveUpdate(params.updateId, session.studentId, session.classId);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body?.headline === 'string') patch.headline = body.headline.trim();
  if (typeof body?.body === 'string') patch.body = body.body.trim();
  if (typeof body?.kind === 'string' && ['progress', 'milestone', 'note'].includes(body.kind)) {
    patch.kind = body.kind;
  }

  const [row] = await db
    .update(projectUpdates)
    .set(patch)
    .where(eq(projectUpdates.id, update!.id))
    .returning();

  await db.insert(activityLog).values({
    classId: update!.classId,
    actorId: session.studentId,
    action: 'update.edited',
    targetId: update!.id,
  }).catch(() => {});

  return NextResponse.json({ update: row });
}

export async function DELETE(_req: NextRequest, { params }: { params: { updateId: string } }) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const { update, error } = await resolveUpdate(params.updateId, session.studentId, session.classId);
  if (error) return error;

  await db
    .update(projectUpdates)
    .set({ deletedAt: new Date() })
    .where(eq(projectUpdates.id, update!.id));

  await db.insert(activityLog).values({
    classId: update!.classId,
    actorId: session.studentId,
    action: 'update.deleted',
    targetId: update!.id,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
