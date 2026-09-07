import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { groups, projectSlots, studentGroupSlots } from '@/lib/schema';
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

  if ('groupSize' in patch) {
    const groupSize = Number(patch.groupSize);
    if (!Number.isInteger(groupSize) || groupSize < 1) {
      return jsonError('groupSize must be a whole number of at least 1', 422);
    }
    patch.groupSize = groupSize;

    // A smaller limit must never invalidate an existing group.
    const existingGroups = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.slotId, slot.id));

    for (const group of existingGroups) {
      const members = await db
        .select({ id: studentGroupSlots.id })
        .from(studentGroupSlots)
        .where(eq(studentGroupSlots.groupId, group.id));
      if (members.length > groupSize) {
        return jsonError(`Cannot set group size to ${groupSize}: an existing group has ${members.length} members`, 409);
      }
    }
  }

  const [row] = await db
    .update(projectSlots)
    .set(patch)
    .where(eq(projectSlots.id, params.slotId))
    .returning();

  // Groups retain their own max size/status, so reconcile them whenever the
  // professor changes the slot size. This re-opens former solo groups when a
  // slot is changed to pairs (or a larger group) and locks groups at capacity.
  if ('groupSize' in patch) {
    const groupSize = row.groupSize;
    const existingGroups = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.slotId, row.id));

    for (const group of existingGroups) {
      const members = await db
        .select({ id: studentGroupSlots.id })
        .from(studentGroupSlots)
        .where(eq(studentGroupSlots.groupId, group.id));

      await db
        .update(groups)
        .set({ maxSize: groupSize, status: members.length >= groupSize ? 'locked' : 'forming' })
        .where(eq(groups.id, group.id));
    }
  }

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
