import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projectSlots } from '@/lib/schema';
import { eq, asc } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';
import { isSlotParticipant } from '@/lib/slot-participation';

export async function GET() {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const rows = await db
    .select()
    .from(projectSlots)
    .where(eq(projectSlots.classId, session.classId))
    .orderBy(asc(projectSlots.createdAt));

  return NextResponse.json({ slots: rows.filter(slot => isSlotParticipant(slot, session.studentId)).map(({ excludedStudentIds: _excluded, ...slot }) => slot) });
}
