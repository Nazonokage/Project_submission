import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { groupInvites, groups, students } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const slotId = req.nextUrl.searchParams.get('slotId');
  if (!slotId) return jsonError('slotId is required', 422);

  const rows = await db
    .select({
      invite: groupInvites,
      groupId: groups.id,
      invitedBy: { id: students.id, name: students.name },
    })
    .from(groupInvites)
    .innerJoin(groups, eq(groups.id, groupInvites.groupId))
    .innerJoin(students, eq(students.id, groupInvites.invitedByStudentId))
    .where(
      and(
        eq(groupInvites.invitedStudentId, session.studentId),
        eq(groupInvites.slotId, slotId),
        eq(groupInvites.status, 'pending')
      )
    );

  return NextResponse.json({ invites: rows });
}
