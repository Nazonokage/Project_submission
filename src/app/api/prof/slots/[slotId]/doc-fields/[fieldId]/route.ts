import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classes, documentationFieldTemplates, projectSlots } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

type Ctx = { params: { slotId: string; fieldId: string } };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getProfSession();
  if (!session) return jsonError('Not authenticated', 401);

  const [slot] = await db
    .select({
      id: projectSlots.id,
      profId: classes.profId,
    })
    .from(projectSlots)
    .innerJoin(classes, eq(classes.id, projectSlots.classId))
    .where(and(eq(projectSlots.id, params.slotId), eq(classes.profId, session.profId)))
    .limit(1);
  if (!slot) return jsonError('Unauthorized or slot not found', 404);

  const [existing] = await db
    .select()
    .from(documentationFieldTemplates)
    .where(
      and(
        eq(documentationFieldTemplates.id, params.fieldId),
        eq(documentationFieldTemplates.slotId, params.slotId)
      )
    )
    .limit(1);
  if (!existing) return jsonError('Field template not found', 404);

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};

  if (typeof body?.label === 'string') {
    const trimmed = body.label.trim();
    if (!trimmed) return jsonError('Label cannot be empty', 400);
    patch.label = trimmed;
  }
  if (body?.fieldType !== undefined) {
    if (!['text', 'textarea', 'url', 'date'].includes(body.fieldType)) {
      return jsonError('Invalid fieldType', 422);
    }
    patch.fieldType = body.fieldType;
  }
  if (body?.required !== undefined) {
    patch.required = Boolean(body.required);
  }
  if (typeof body?.sortOrder === 'number') {
    patch.sortOrder = body.sortOrder;
  }

  const [updated] = await db
    .update(documentationFieldTemplates)
    .set(patch)
    .where(eq(documentationFieldTemplates.id, params.fieldId))
    .returning();

  return NextResponse.json({ field: updated });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getProfSession();
  if (!session) return jsonError('Not authenticated', 401);

  const [slot] = await db
    .select({
      id: projectSlots.id,
      profId: classes.profId,
    })
    .from(projectSlots)
    .innerJoin(classes, eq(classes.id, projectSlots.classId))
    .where(and(eq(projectSlots.id, params.slotId), eq(classes.profId, session.profId)))
    .limit(1);
  if (!slot) return jsonError('Unauthorized or slot not found', 404);

  const [deleted] = await db
    .delete(documentationFieldTemplates)
    .where(
      and(
        eq(documentationFieldTemplates.id, params.fieldId),
        eq(documentationFieldTemplates.slotId, params.slotId)
      )
    )
    .returning();

  if (!deleted) return jsonError('Field template not found', 404);

  return NextResponse.json({ success: true, field: deleted });
}
