import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { studentGroupSlots, titles } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { titleId: string } }
) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const [title] = await db
    .select()
    .from(titles)
    .where(and(eq(titles.id, params.titleId), eq(titles.classId, session.classId)))
    .limit(1);
  if (!title) return jsonError('Title not found', 404);

  // Requester must be a member of the group that owns this title
  const [membership] = await db
    .select()
    .from(studentGroupSlots)
    .where(
      and(eq(studentGroupSlots.studentId, session.studentId), eq(studentGroupSlots.groupId, title.groupId))
    )
    .limit(1);
  if (!membership) return jsonError('You are not a member of this title\'s group', 403);
  if (title.status === 'verified') {
    return jsonError('Verified titles cannot be edited', 409);
  }

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updatedAt: new Date(), updatedByStudentId: session.studentId };
  if (typeof body?.text === 'string') patch.text = body.text.trim();
  if (typeof body?.description === 'string') patch.description = body.description.trim();
  if (Array.isArray(body?.techStack)) patch.techStack = body.techStack;
  if (typeof body?.targetUsers === 'string') patch.targetUsers = body.targetUsers.trim();

  if (title.status === 'rejected') {
    patch.status = 'pending';
    patch.rejectionReason = null;
  }

  const [row] = await db.update(titles).set(patch).where(eq(titles.id, title.id)).returning();
  return NextResponse.json({ title: row });
}
