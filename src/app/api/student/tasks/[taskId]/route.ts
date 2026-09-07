import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLog, studentGroupSlots, tasks } from '@/lib/schema';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';
import { isProgressStatus, type ProgressStatus } from '@/lib/progress';

type Ctx = { params: { taskId: string } };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, params.taskId), isNull(tasks.deletedAt)))
    .limit(1);
  if (!existing) return jsonError('Task not found', 404);

  const [membership] = await db
    .select()
    .from(studentGroupSlots)
    .where(
      and(
        eq(studentGroupSlots.studentId, session.studentId),
        eq(studentGroupSlots.groupId, existing.groupId)
      )
    )
    .limit(1);
  if (!membership) return jsonError('Only group members can edit this task', 403);

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body?.name === 'string') {
    const trimmed = body.name.trim();
    if (!trimmed) return jsonError('Task name cannot be empty', 400);
    patch.name = trimmed;
  }
  if (body?.description !== undefined) {
    patch.description = typeof body.description === 'string' ? body.description.trim() || null : null;
  }
  if (body?.assigneeStudentId !== undefined) {
    patch.assigneeStudentId = body.assigneeStudentId || null;
  }
  if (body?.dueDate !== undefined) {
    if (body.dueDate) {
      const d = new Date(body.dueDate);
      patch.dueDate = isNaN(d.getTime()) ? null : d;
    } else {
      patch.dueDate = null;
    }
  }
  if (body?.sortOrder !== undefined && typeof body.sortOrder === 'number') {
    patch.sortOrder = body.sortOrder;
  }

  let statusChanged = false;
  if (body?.status !== undefined) {
    if (!isProgressStatus(body.status)) {
      return jsonError('Invalid status', 422);
    }
    if (body.status !== existing.status) {
      patch.status = body.status;
      statusChanged = true;
    }
  }

  const [updated] = await db
    .update(tasks)
    .set(patch)
    .where(eq(tasks.id, params.taskId))
    .returning();

  if (statusChanged) {
    await db
      .insert(activityLog)
      .values({
        classId: existing.classId,
        actorId: session.studentId,
        action: 'task.status_changed',
        targetId: existing.id,
      })
      .catch(() => {});
  }

  return NextResponse.json({ task: updated });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, params.taskId), isNull(tasks.deletedAt)))
    .limit(1);
  if (!existing) return jsonError('Task not found', 404);

  const [membership] = await db
    .select()
    .from(studentGroupSlots)
    .where(
      and(
        eq(studentGroupSlots.studentId, session.studentId),
        eq(studentGroupSlots.groupId, existing.groupId)
      )
    )
    .limit(1);
  if (!membership) return jsonError('Only group members can delete this task', 403);

  const [deleted] = await db
    .update(tasks)
    .set({ deletedAt: new Date() })
    .where(eq(tasks.id, params.taskId))
    .returning();

  await db
    .insert(activityLog)
    .values({
      classId: existing.classId,
      actorId: session.studentId,
      action: 'task.deleted',
      targetId: existing.id,
    })
    .catch(() => {});

  return NextResponse.json({ success: true, task: deleted });
}
