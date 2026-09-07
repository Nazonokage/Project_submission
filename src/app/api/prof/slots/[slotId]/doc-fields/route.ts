import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { classes, documentationFieldTemplates, projectSlots } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

type Ctx = { params: { slotId: string } };

// GET all doc field templates for a slot
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getProfSession();
  if (!session) return jsonError('Not authenticated', 401);

  const [slot] = await db
    .select({
      id: projectSlots.id,
      classId: projectSlots.classId,
      profId: classes.profId,
    })
    .from(projectSlots)
    .innerJoin(classes, eq(classes.id, projectSlots.classId))
    .where(and(eq(projectSlots.id, params.slotId), eq(classes.profId, session.profId)))
    .limit(1);
  if (!slot) return jsonError('Slot not found or unauthorized', 404);

  const fields = await db
    .select()
    .from(documentationFieldTemplates)
    .where(eq(documentationFieldTemplates.slotId, params.slotId))
    .orderBy(asc(documentationFieldTemplates.sortOrder), asc(documentationFieldTemplates.createdAt));

  return NextResponse.json({ fields });
}

// POST create a new doc field template
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getProfSession();
  if (!session) return jsonError('Not authenticated', 401);

  const [slot] = await db
    .select({
      id: projectSlots.id,
      classId: projectSlots.classId,
      profId: classes.profId,
    })
    .from(projectSlots)
    .innerJoin(classes, eq(classes.id, projectSlots.classId))
    .where(and(eq(projectSlots.id, params.slotId), eq(classes.profId, session.profId)))
    .limit(1);
  if (!slot) return jsonError('Slot not found or unauthorized', 404);

  const body = await req.json().catch(() => null);
  const label = (body?.label as string | undefined)?.trim();
  let fieldKey = (body?.fieldKey as string | undefined)?.trim();
  const fieldType = (body?.fieldType as string | undefined) || 'textarea';
  const required = Boolean(body?.required);
  const sortOrder = typeof body?.sortOrder === 'number' ? body.sortOrder : 0;

  if (!label) return jsonError('Label is required', 400);

  if (!fieldKey) {
    // Generate slug from label
    fieldKey = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
  if (!fieldKey) fieldKey = `field_${Date.now()}`;

  if (!['text', 'textarea', 'url', 'date'].includes(fieldType)) {
    return jsonError('fieldType must be text, textarea, url, or date', 422);
  }

  // Check unique key in slot
  const [existing] = await db
    .select()
    .from(documentationFieldTemplates)
    .where(
      and(
        eq(documentationFieldTemplates.slotId, params.slotId),
        eq(documentationFieldTemplates.fieldKey, fieldKey)
      )
    )
    .limit(1);
  if (existing) {
    return jsonError(`Field key "${fieldKey}" already exists in this slot`, 409);
  }

  const [field] = await db
    .insert(documentationFieldTemplates)
    .values({
      slotId: params.slotId,
      fieldKey,
      label,
      fieldType,
      required,
      sortOrder,
    })
    .returning();

  return NextResponse.json({ field }, { status: 201 });
}
