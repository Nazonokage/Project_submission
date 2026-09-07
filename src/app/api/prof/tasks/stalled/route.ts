import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNull, lt, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classes, groups, projectSlots, students, tasks, titles } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET(req: NextRequest) {
  const session = await getProfSession();
  if (!session) return jsonError('Not authenticated', 401);

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  if (!classId) return jsonError('classId is required', 400);

  const daysParam = parseInt(searchParams.get('days') || '7', 10);
  const days = isNaN(daysParam) || daysParam < 1 ? 7 : daysParam;

  // Verify class ownership
  const [cls] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.profId, session.profId)))
    .limit(1);
  if (!cls) return jsonError('Forbidden or class not found', 403);

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const stalledTasks = await db
    .select({
      id: tasks.id,
      name: tasks.name,
      status: tasks.status,
      dueDate: tasks.dueDate,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      titleId: tasks.titleId,
      titleText: titles.text,
      slotId: tasks.slotId,
      slotLabel: projectSlots.label,
      groupId: tasks.groupId,
      assigneeName: students.name,
      assigneeIdNumber: students.idNumber,
    })
    .from(tasks)
    .innerJoin(titles, eq(titles.id, tasks.titleId))
    .innerJoin(projectSlots, eq(projectSlots.id, tasks.slotId))
    .leftJoin(students, eq(students.id, tasks.assigneeStudentId))
    .where(
      and(
        eq(tasks.classId, classId),
        ne(tasks.status, 'done'),
        isNull(tasks.deletedAt),
        isNull(titles.deletedAt),
        lt(tasks.updatedAt, cutoff)
      )
    )
    .orderBy(desc(tasks.updatedAt));

  return NextResponse.json({ stalledTasks, thresholdDays: days });
}
