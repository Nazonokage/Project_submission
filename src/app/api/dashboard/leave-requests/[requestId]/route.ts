import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { activityLog, classes, groupLeaveRequests } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';
import { applyApprovedLeave } from '@/lib/leave';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { requestId: string } }
) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const [request] = await db
    .select()
    .from(groupLeaveRequests)
    .where(eq(groupLeaveRequests.id, params.requestId))
    .limit(1);
  if (!request) return jsonError('Leave request not found', 404);
  if (request.status !== 'pending') return jsonError('This request has already been resolved', 409);

  const [cls] = await db.select().from(classes).where(eq(classes.id, request.classId)).limit(1);
  if (!cls || cls.profId !== prof.profId) return jsonError('Not authorized', 403);

  const body = await req.json().catch(() => null);
  const decision = body?.decision as 'approved' | 'declined' | undefined;
  if (decision !== 'approved' && decision !== 'declined') {
    return jsonError('decision must be "approved" or "declined"', 422);
  }

  if (decision === 'approved') {
    await applyApprovedLeave(request.groupId, request.studentId);
  }

  const [row] = await db
    .update(groupLeaveRequests)
    .set({
      status: decision,
      resolvedAt: new Date(),
      resolvedByProfId: prof.profId,
    })
    .where(eq(groupLeaveRequests.id, request.id))
    .returning();

  await db.insert(activityLog).values({
    classId: request.classId,
    actorId: prof.profId,
    action: decision === 'approved' ? 'group.leave_approved' : 'group.leave_declined',
    targetId: request.id,
  });

  return NextResponse.json({ request: row });
}
