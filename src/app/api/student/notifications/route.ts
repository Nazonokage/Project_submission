import { NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { feedback, feedbackReads, professors, studentGroupSlots, titles } from '@/lib/schema';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET() {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);
  const rows = await db.select({
    readAt: feedbackReads.readAt, id: feedback.id, body: feedback.body, type: feedback.type, status: feedback.status,
    createdAt: feedback.createdAt, professorName: professors.name,
    titleId: titles.id, titleText: titles.text, slotId: titles.slotId, classId: titles.classId,
  }).from(feedback)
    .innerJoin(titles, eq(titles.id, feedback.titleId))
    .innerJoin(studentGroupSlots, and(
      eq(studentGroupSlots.groupId, titles.groupId), eq(studentGroupSlots.slotId, titles.slotId),
      eq(studentGroupSlots.studentId, session.studentId)
    ))
    .innerJoin(professors, eq(professors.id, feedback.givenByProfId))
    .leftJoin(feedbackReads, and(eq(feedbackReads.feedbackId, feedback.id), eq(feedbackReads.studentId, session.studentId)))
    .where(and(eq(titles.classId, session.classId), eq(feedback.classId, session.classId), isNull(titles.deletedAt)))
    .orderBy(desc(feedback.createdAt));
  return NextResponse.json({ notifications: rows });
}

export async function PATCH(req: Request) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);
  const body = await req.json().catch(() => null);
  if (typeof body?.feedbackId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.feedbackId)) {
    return jsonError('A valid feedbackId is required', 422);
  }
  const [allowed] = await db.select({ id: feedback.id }).from(feedback)
    .innerJoin(titles, eq(titles.id, feedback.titleId))
    .innerJoin(studentGroupSlots, and(
      eq(studentGroupSlots.groupId, titles.groupId), eq(studentGroupSlots.slotId, titles.slotId),
      eq(studentGroupSlots.studentId, session.studentId)
    ))
    .where(and(eq(feedback.id, body.feedbackId), eq(feedback.classId, session.classId), eq(titles.classId, session.classId), isNull(titles.deletedAt))).limit(1);
  if (!allowed) return jsonError('Feedback not found', 404);
  await db.insert(feedbackReads).values({ studentId: session.studentId, feedbackId: allowed.id }).onConflictDoNothing();
  return NextResponse.json({ success: true });
}
