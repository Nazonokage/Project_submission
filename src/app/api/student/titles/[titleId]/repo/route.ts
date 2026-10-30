import { externalUrlError } from '@/lib/safe-url';
import { githubRepoUrlError } from '@/lib/project-readiness';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projectSlots, studentGroupSlots, titles } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function PATCH(
  req: NextRequest,
  { params: promisedParams }: { params: Promise<{ titleId: string }> }
) {
  const params = await promisedParams;
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const [title] = await db
    .select()
    .from(titles)
    .where(and(eq(titles.id, params.titleId), eq(titles.classId, session.classId)))
    .limit(1);
  if (!title) return jsonError('Title not found', 404);


  const [membership] = await db
    .select()
    .from(studentGroupSlots)
    .where(
      and(eq(studentGroupSlots.studentId, session.studentId), eq(studentGroupSlots.groupId, title.groupId))
    )
    .limit(1);
  if (!membership) return jsonError('You are not a member of this title\'s group', 403);

  const [slot] = await db.select().from(projectSlots).where(eq(projectSlots.id, title.slotId)).limit(1);

  const body = await req.json().catch(() => null);
  for (const field of ["deploymentUrl"]) {
    const invalid = externalUrlError(body?.[field]);
    if (invalid) return jsonError(invalid, 422);
  }
  const repoUrl = (body?.repoUrl as string | undefined)?.trim();
  const deploymentUrl = (body?.deploymentUrl as string | undefined)?.trim();

  const repoError = githubRepoUrlError(repoUrl);
  if (repoError) return jsonError(repoError, 422);
  if (title.status === 'verified' && slot?.requireDeploymentUrl && !deploymentUrl) {
    return jsonError('deploymentUrl is required for this project slot', 422);
  }

  const [row] = await db
    .update(titles)
    .set({
      repoUrl,
      deploymentUrl: deploymentUrl || null,
      updatedAt: new Date(),
      updatedByStudentId: session.studentId,
    })
    .where(eq(titles.id, title.id))
    .returning();

  return NextResponse.json({ title: row });
}
