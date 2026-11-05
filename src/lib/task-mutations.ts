import { assertTaskAssignee } from '@/lib/task-access';
import { requireStudentProjectReady } from '@/lib/student-project-access';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLog, classes, studentGroupSlots, tasks } from '@/lib/schema';
import { getProfSession, getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';
import { isProgressStatus } from '@/lib/progress';

type Ctx = { params: Promise<{ taskId: string }> };

type Role = 'student' | 'prof';

async function authorizeTask(taskId: string, role: Role) {
  const professor = role === 'prof' ? await getProfSession() : null;
  const student = role === 'student' ? await getStudentSession() : null;
  if (!professor && !student) return jsonError('Not authenticated', 401);

  const [existing] = await db.select().from(tasks)
    .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt))).limit(1);
  if (!existing) return jsonError('Task not found', 404);

  if (professor) {
    const [ownedClass] = await db.select({ id: classes.id }).from(classes)
      .where(and(eq(classes.id, existing.classId), eq(classes.profId, professor.profId))).limit(1);
    if (!ownedClass) return jsonError('Forbidden', 403);
    return { existing, actorId: professor.profId };
  }

  if (!student) return jsonError('Not authenticated', 401);
  const [membership] = await db.select().from(studentGroupSlots)
    .where(and(eq(studentGroupSlots.studentId, student.studentId), eq(studentGroupSlots.groupId, existing.groupId)))
    .limit(1);
  if (!membership) return jsonError('Only group members can modify this task', 403);

  const requiredInfo = await requireStudentProjectReady(existing.titleId, student.classId, student.studentId);
  if (requiredInfo) return requiredInfo;
  return { existing, actorId: student.studentId };
}

export async function updateTask(req: NextRequest, { params }: Ctx, role: Role) {
  const access = await authorizeTask((await params).taskId, role);
  if (access instanceof Response) return access;
  const { existing, actorId } = access;

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
    const invalid = await assertTaskAssignee(body.assigneeStudentId, existing.groupId, existing.slotId, existing.classId);
    if (invalid) return invalid;
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
    .where(and(eq(tasks.id, existing.id), isNull(tasks.deletedAt)))
    .returning();

  if (!updated) return jsonError('Task not found', 404);

  if (statusChanged) {
    await db
      .insert(activityLog)
      .values({
        classId: existing.classId,
        actorId,
        action: 'task.status_changed',
        targetId: existing.id,
      })
      .catch(() => {});
  }

  return NextResponse.json({ task: updated });
}

export async function deleteTask(_req: NextRequest, { params }: Ctx, role: Role) {
  const access = await authorizeTask((await params).taskId, role);
  if (access instanceof Response) return access;
  const { existing, actorId } = access;
  const [deleted] = await db
    .update(tasks)
    .set({ deletedAt: new Date() })
    .where(and(eq(tasks.id, existing.id), isNull(tasks.deletedAt)))
    .returning();

  if (!deleted) return jsonError('Task not found', 404);

  await db
    .insert(activityLog)
    .values({
      classId: existing.classId,
      actorId,
      action: 'task.deleted',
      targetId: existing.id,
    })
    .catch(() => {});

  return NextResponse.json({ success: true, task: deleted });
}
