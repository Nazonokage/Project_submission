import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { feedback, professors, titles } from '@/lib/schema';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';
import { isSchemaDrift } from '@/lib/pg-errors';
import { selectTitleBy } from '@/lib/titles-query';

export async function GET(_req: NextRequest, { params }: { params: { titleId: string } }) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const title = await selectTitleBy(and(eq(titles.id, params.titleId), eq(titles.classId, session.classId))!);
  if (!title) return jsonError('Title not found', 404);

  try {
    const rows = await db
      .select({
        id: feedback.id,
        type: feedback.type,
        body: feedback.body,
        status: feedback.status,
        reportId: feedback.reportId,
        createdAt: feedback.createdAt,
        professorName: professors.name,
      })
      .from(feedback)
      .innerJoin(professors, eq(professors.id, feedback.givenByProfId))
      .where(eq(feedback.titleId, title.id))
      .orderBy(desc(feedback.createdAt));
    return NextResponse.json({ feedback: rows });
  } catch (err) {
    if (isSchemaDrift(err)) return NextResponse.json({ feedback: [], schemaMissing: true });
    throw err;
  }
}
