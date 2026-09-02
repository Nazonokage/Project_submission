import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projectSlots } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, assertSlotInClass, jsonError } from '@/lib/helpers';

type Params = { params: { classId: string; slotId: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  const slot = await assertSlotInClass(params.slotId, params.classId);
  if (!slot) return jsonError('Slot not found', 404);

  const body = await req.json().catch(() => null);
  if (!body) return jsonError('Invalid body', 422);

  const patch: Record<string, unknown> = {};
  for (const key of [
    'label',
    'groupSize',
    'titlesRequiredMin',
    'titlesAllowedMax',
    'requireDeploymentUrl',
    'requireTechStack',
    'requireTargetUsers',
    'locked',
  ] as const) {
    if (key in body) patch[key] = body[key];
  }
  if ('duplicateCheck' in body) {
    patch.duplicateCheck = body.duplicateCheck === 'strict' ? 'strict' : 'warn';
  }
  if ('deadline' in body) {
    patch.deadline = body.deadline ? new Date(body.deadline) : null;
  }

  const [row] = await db
    .update(projectSlots)
    .set(patch)
    .where(eq(projectSlots.id, params.slotId))
    .returning();

  return NextResponse.json({ slot: row });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  const slot = await assertSlotInClass(params.slotId, params.classId);
  if (!slot) return jsonError('Slot not found', 404);

  await db.delete(projectSlots).where(eq(projectSlots.id, params.slotId));
  return NextResponse.json({ ok: true });
}
