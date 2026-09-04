import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { feedback } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, jsonError } from '@/lib/helpers';
import { isSchemaDrift } from '@/lib/pg-errors';

export async function PATCH(req: NextRequest, { params }: { params: { feedbackId: string } }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const body = await req.json().catch(() => null);
  const status = body?.status as string | undefined;
  if (status !== 'open' && status !== 'resolved') {
    return jsonError('status must be open or resolved', 422);
  }

  try {
    const [row] = await db.select().from(feedback).where(eq(feedback.id, params.feedbackId)).limit(1);
    if (!row) return jsonError('Feedback not found', 404);
    const cls = await assertClassOwnedByProf(row.classId, prof.profId);
    if (!cls) return jsonError('Not authorized', 403);

    const [updated] = await db
      .update(feedback)
      .set({ status, updatedAt: new Date() })
      .where(eq(feedback.id, row.id))
      .returning();
    return NextResponse.json({ feedback: updated });
  } catch (err) {
    if (isSchemaDrift(err)) return jsonError('Feedback is not available yet.', 503);
    throw err;
  }
}
