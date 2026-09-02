import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { titles, groups } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, jsonError } from '@/lib/helpers';

// Prof adds a title directly to an existing group. Optionally auto-verified.
export async function POST(req: NextRequest) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const body = await req.json().catch(() => null);
  const classId = body?.classId as string | undefined;
  const groupId = body?.groupId as string | undefined;
  const text = (body?.text as string | undefined)?.trim();
  const description = (body?.description as string | undefined)?.trim();
  const techStack = Array.isArray(body?.techStack) ? (body.techStack as string[]) : [];
  const targetUsers = (body?.targetUsers as string | undefined)?.trim() || null;
  const autoVerify = !!body?.autoVerify;

  if (!classId || !groupId || !text || !description) {
    return jsonError('classId, groupId, text and description are required', 422);
  }

  const cls = await assertClassOwnedByProf(classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.classId, classId)))
    .limit(1);
  if (!group) return jsonError('Group not found', 404);

  const [row] = await db
    .insert(titles)
    .values({
      classId,
      slotId: group.slotId,
      groupId,
      text,
      description,
      techStack,
      targetUsers,
      addedBy: 'prof',
      addedByProfId: prof.profId,
      status: autoVerify ? 'verified' : 'pending',
      verifiedAt: autoVerify ? new Date() : null,
    })
    .returning();

  return NextResponse.json({ title: row }, { status: 201 });
}
