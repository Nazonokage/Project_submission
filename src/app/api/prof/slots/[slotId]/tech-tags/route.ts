import { NextResponse } from 'next/server';
import { getTechTags } from '@/lib/tech-tags';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, jsonError } from '@/lib/helpers';
import { db } from '@/lib/db';
import { projectSlots } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET(_req: Request, { params }: { params: { slotId: string } }) {
  const session = await getProfSession();
  if (!session) return jsonError('Not authenticated', 401);
  const [slot] = await db.select().from(projectSlots).where(eq(projectSlots.id, params.slotId)).limit(1);
  if (!slot || !await assertClassOwnedByProf(slot.classId, session.profId)) return jsonError('Slot not found', 404);
  return NextResponse.json({ tags: await getTechTags(slot.classId, slot.id) });
}
