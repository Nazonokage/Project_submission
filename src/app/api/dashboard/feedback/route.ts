import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { feedback, professors, titles } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, jsonError } from '@/lib/helpers';
import { isSchemaDrift } from '@/lib/pg-errors';
import { selectTitleBy } from '@/lib/titles-query';

const TYPES = ['comment', 'request_changes', 'approval'] as const;

export async function GET(req: NextRequest) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const titleId = req.nextUrl.searchParams.get('titleId');
  if (!titleId) return jsonError('titleId is required', 422);

  const title = await selectTitleBy(eq(titles.id, titleId));
  if (!title) return jsonError('Title not found', 404);
  const cls = await assertClassOwnedByProf(title.classId, prof.profId);
  if (!cls) return jsonError('Not authorized', 403);

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

export async function POST(req: NextRequest) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const body = await req.json().catch(() => null);
  const titleId = body?.titleId as string | undefined;
  const type = body?.type as string | undefined;
  const text = (body?.body as string | undefined)?.trim();
  const reportId = (body?.reportId as string | undefined) || null;

  if (!titleId || !type || !text) return jsonError('titleId, type, and body are required', 422);
  if (!TYPES.includes(type as (typeof TYPES)[number])) {
    return jsonError('type must be comment, request_changes, or approval', 422);
  }

  const title = await selectTitleBy(eq(titles.id, titleId));
  if (!title) return jsonError('Title not found', 404);
  const cls = await assertClassOwnedByProf(title.classId, prof.profId);
  if (!cls) return jsonError('Not authorized', 403);

  try {
    const [row] = await db
      .insert(feedback)
      .values({
        classId: title.classId,
        slotId: title.slotId,
        titleId: title.id,
        reportId,
        groupId: title.groupId,
        givenByProfId: prof.profId,
        type,
        body: text,
      })
      .returning();
    return NextResponse.json({ feedback: row }, { status: 201 });
  } catch (err) {
    if (isSchemaDrift(err)) {
      return jsonError('Feedback is not available yet. Apply the latest schema on Neon.', 503);
    }
    throw err;
  }
}
