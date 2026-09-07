import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classes, students, tasks, titles } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET(req: NextRequest) {
  const session = await getProfSession();
  if (!session) return jsonError('Not authenticated', 401);

  const { searchParams } = new URL(req.url);
  const titleId = searchParams.get('titleId');
  if (!titleId) return jsonError('titleId is required', 400);

  const [title] = await db
    .select()
    .from(titles)
    .where(eq(titles.id, titleId))
    .limit(1);
  if (!title) return jsonError('Title not found', 404);

  // Verify prof owns the class
  const [cls] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, title.classId), eq(classes.profId, session.profId)))
    .limit(1);
  if (!cls) return jsonError('Forbidden', 403);

  // Return all tasks including soft-deleted for audit trail
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
    .leftJoin(students, eq(students.id, tasks.assigneeStudentId))
    .where(eq(tasks.titleId, titleId))
    .orderBy(asc(tasks.sortOrder), desc(tasks.createdAt));

  return NextResponse.json({ tasks: rows });
}
