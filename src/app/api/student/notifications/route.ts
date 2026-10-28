import { NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { feedback, professors, studentGroupSlots, titles } from '@/lib/schema';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET() {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);
  const rows = await db.select({
    id: feedback.id, body: feedback.body, type: feedback.type, status: feedback.status,
    createdAt: feedback.createdAt, professorName: professors.name,
    titleId: titles.id, titleText: titles.text, slotId: titles.slotId, classId: titles.classId,
  }).from(feedback)
    .innerJoin(titles, eq(titles.id, feedback.titleId))
    .innerJoin(studentGroupSlots, and(
      eq(studentGroupSlots.groupId, titles.groupId), eq(studentGroupSlots.slotId, titles.slotId),
      eq(studentGroupSlots.studentId, session.studentId)
    ))
    .innerJoin(professors, eq(professors.id, feedback.givenByProfId))
    .where(and(eq(titles.classId, session.classId), eq(feedback.classId, session.classId), isNull(titles.deletedAt)))
    .orderBy(desc(feedback.createdAt));
  return NextResponse.json({ notifications: rows });
}
