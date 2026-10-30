import { assertActionRateLimit } from '@/lib/rate-limit';
import { requireStudentTitleAccess } from '@/lib/student-title-access';
import { assertTaskAssignee } from '@/lib/task-access';
import { projectRequirementsError, projectApprovalError } from '@/lib/project-readiness';
import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNull, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityLog, studentGroupSlots, students, tasks, titles } from '@/lib/schema';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';
import { isProgressStatus } from '@/lib/progress';

export async function GET(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const { searchParams } = new URL(req.url);
  const titleId = searchParams.get('titleId');
  if (!titleId) return jsonError('titleId is required', 400);

  const [title] = await db
    .select()
    .from(titles)
    .where(and(eq(titles.id, titleId), eq(titles.classId, session.classId), isNull(titles.deletedAt)))
    .limit(1);
  if (!title) return jsonError('Title not found', 404);
  const accessError = await requireStudentTitleAccess(title, session);
  if (accessError) return accessError;
  const approvalError = projectApprovalError(title);
  if (approvalError) return jsonError(approvalError, 403);
  const requiredInfo = projectRequirementsError(title);
  if (requiredInfo) return jsonError(requiredInfo, 428);

  const rows = await db
    .select({
      id: tasks.id,
      titleId: tasks.titleId,
      groupId: tasks.groupId,
      classId: tasks.classId,
      slotId: tasks.slotId,
      name: tasks.name,
      description: tasks.description,
      status: tasks.status,
      assigneeStudentId: tasks.assigneeStudentId,
      assigneeName: students.name,
      assigneeIdNumber: students.idNumber,
      dueDate: tasks.dueDate,
      sortOrder: tasks.sortOrder,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      deletedAt: tasks.deletedAt,
    })
    .from(tasks)
    .leftJoin(students, and(eq(students.id, tasks.assigneeStudentId), eq(students.classId, tasks.classId)))
    .where(and(eq(tasks.titleId, titleId), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.sortOrder), desc(tasks.createdAt));

  return NextResponse.json({ tasks: rows });
}

export async function POST(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const body = await req.json().catch(() => null);
  const limited = await assertActionRateLimit({ key: session.studentId, action: 'project_write', max: 60, message: 'Too many updates. Try again later.' });
  if (limited) return limited;
  if ((typeof body?.name === 'string' && body.name.length > 20000) || (typeof body?.description === 'string' && body.description.length > 20000)) return jsonError('Text is too long (maximum 20,000 characters)', 422);
  const titleId = body?.titleId as string | undefined;
  const name = (body?.name as string | undefined)?.trim();
  const description = (body?.description as string | undefined)?.trim() || null;
  const assigneeStudentId = (body?.assigneeStudentId as string | undefined) || null;
  const dueDateStr = body?.dueDate as string | undefined;
  // All newly created tasks start in Planning, regardless of client input.
  const status = 'planning';

  if (!titleId) return jsonError('titleId is required', 400);
  if (!name) return jsonError('Task name is required', 400);
  if (!isProgressStatus(status)) return jsonError('Invalid status', 422);

  const [title] = await db
    .select()
    .from(titles)
    .where(and(eq(titles.id, titleId), eq(titles.classId, session.classId), isNull(titles.deletedAt)))
    .limit(1);
  if (!title) return jsonError('Title not found', 404);
  const accessError = await requireStudentTitleAccess(title, session);
  if (accessError) return accessError;
  const approvalError = projectApprovalError(title);
  if (approvalError) return jsonError(approvalError, 403);
  const requiredInfo = projectRequirementsError(title);
  if (requiredInfo) return jsonError(requiredInfo, 428);

  const [membership] = await db
    .select()
    .from(studentGroupSlots)
    .where(
      and(
        eq(studentGroupSlots.studentId, session.studentId),
        eq(studentGroupSlots.groupId, title.groupId)
      )
    )
    .limit(1);
  if (!membership) return jsonError('Only group members can add tasks to this project', 403);

  const assigneeError = await assertTaskAssignee(assigneeStudentId, title.groupId, title.slotId, title.classId);
  if (assigneeError) return assigneeError;

  let dueDate: Date | null = null;
  if (dueDateStr) {
    const d = new Date(dueDateStr);
    if (!isNaN(d.getTime())) dueDate = d;
  }

  const [task] = await db
    .insert(tasks)
    .values({
      titleId: title.id,
      groupId: title.groupId,
      classId: title.classId,
      slotId: title.slotId,
      name,
      description,
      status,
      assigneeStudentId,
      dueDate,
      sortOrder: 0,
    })
    .returning();

  await db
    .insert(activityLog)
    .values({
      classId: title.classId,
      actorId: session.studentId,
      action: 'task.created',
      targetId: task.id,
    })
    .catch(() => {});

  return NextResponse.json({ task }, { status: 201 });
}
