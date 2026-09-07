import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documentationFieldTemplates, projectSlots } from '@/lib/schema';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

type Ctx = { params: { slotId: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const [slot] = await db
    .select({
      id: projectSlots.id,
      classId: projectSlots.classId,
    })
    .from(projectSlots)
    .where(and(eq(projectSlots.id, params.slotId), eq(projectSlots.classId, session.classId)))
    .limit(1);
  if (!slot) return jsonError('Slot not found', 404);

  const fields = await db
    .select()
    .from(documentationFieldTemplates)
    .where(eq(documentationFieldTemplates.slotId, params.slotId))
    .orderBy(asc(documentationFieldTemplates.sortOrder), asc(documentationFieldTemplates.createdAt));

  return NextResponse.json({ fields });
}
