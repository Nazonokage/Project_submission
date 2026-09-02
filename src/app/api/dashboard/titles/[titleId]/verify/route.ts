import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { titles, classes, activityLog } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { titleId: string } }
) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const [title] = await db.select().from(titles).where(eq(titles.id, params.titleId)).limit(1);
  if (!title) return jsonError('Title not found', 404);

  const [cls] = await db.select().from(classes).where(eq(classes.id, title.classId)).limit(1);
  if (!cls || cls.profId !== prof.profId) return jsonError('Not authorized', 403);

  const body = await req.json().catch(() => null);
  const decision = body?.decision as 'verified' | 'rejected' | undefined;
  if (decision !== 'verified' && decision !== 'rejected') {
    return jsonError('decision must be "verified" or "rejected"', 422);
  }
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';

  const [row] = await db
    .update(titles)
    .set({
      status: decision,
      verifiedAt: decision === 'verified' ? new Date() : null,
      rejectionReason: decision === 'rejected' ? comment || null : null,
      updatedAt: new Date(),
    })
    .where(eq(titles.id, title.id))
    .returning();

  await db.insert(activityLog).values({
    classId: title.classId,
    actorId: prof.profId,
    action: decision === 'verified' ? 'title.verified' : 'title.rejected',
    targetId: title.id,
  });

  return NextResponse.json({ title: row });
}
