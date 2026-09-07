import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNull, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tasks, titles } from '@/lib/schema';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId');

  const conditions = [
    eq(tasks.assigneeStudentId, session.studentId),
    eq(tasks.classId, session.classId),
    isNull(tasks.deletedAt),
  ];
  if (groupId) {
    conditions.push(eq(tasks.groupId, groupId));
  }

  const rows = await db
    .select({
      id: tasks.id,
      titleId: tasks.titleId,
      titleText: titles.text,
      groupId: tasks.groupId,
      classId: tasks.classId,
      slotId: tasks.slotId,
      name: tasks.name,
      description: tasks.description,
      status: tasks.status,
      dueDate: tasks.dueDate,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .innerJoin(titles, eq(titles.id, tasks.titleId))
    .where(and(...conditions))
    .orderBy(asc(tasks.dueDate), desc(tasks.createdAt));

  return NextResponse.json({ tasks: rows });
}
