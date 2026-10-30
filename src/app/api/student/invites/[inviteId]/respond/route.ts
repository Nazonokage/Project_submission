import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { groupInvites } from '@/lib/schema';
import { getStudentSession } from '@/lib/auth';
import { isUuid, jsonError } from '@/lib/helpers';
import { pgErrorCode } from '@/lib/pg-errors';

export async function POST(req: NextRequest, { params: promisedParams }: { params: Promise<{ inviteId: string }> }) {
  const params = await promisedParams;
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);
  if (!isUuid(params.inviteId)) return jsonError('Invitation not found', 404);
  const body = await req.json().catch(() => null);
  if (body?.action === 'decline') {
    const rows = await db.update(groupInvites).set({ status: 'declined' }).where(and(
      eq(groupInvites.id, params.inviteId), eq(groupInvites.invitedStudentId, session.studentId),
      eq(groupInvites.classId, session.classId), eq(groupInvites.status, 'pending')
    )).returning({ id: groupInvites.id });
    return rows.length ? NextResponse.json({ ok: true }) : jsonError('Invitation already resolved or not found', 409);
  }
  if (body?.action !== 'accept') return jsonError('Choose accept or decline', 422);
  try {
    const result = await db.execute(sql`SELECT accept_project_invite(${params.inviteId}::uuid, ${session.studentId}::uuid, ${session.classId}::uuid) AS result`);
    const response = result.rows[0]?.result as { ok?: boolean; groupId?: string; error?: string } | undefined;
    if (!response?.ok) return jsonError(response?.error || 'Invitation unavailable', 409);
    return NextResponse.json(response);
  } catch (error) {
    if (['23505', '23514', '40001', '40P01'].includes(pgErrorCode(error) || '')) return jsonError('The group changed. Refresh and try again.', 409);
    if (pgErrorCode(error) === '42883') return jsonError('Group security update is not installed yet. Ask your professor to apply the security migration.', 503);
    throw error;
  }
}
