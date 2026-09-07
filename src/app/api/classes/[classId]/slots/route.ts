import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documentationFieldTemplates, projectSlots } from '@/lib/schema';
import { eq, asc } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, jsonError } from '@/lib/helpers';

export async function GET(_req: NextRequest, { params }: { params: { classId: string } }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  const rows = await db
    .select()
    .from(projectSlots)
    .where(eq(projectSlots.classId, params.classId))
    .orderBy(asc(projectSlots.createdAt));

  return NextResponse.json({ slots: rows });
}

export async function POST(req: NextRequest, { params }: { params: { classId: string } }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  const body = await req.json().catch(() => null);
  const label = (body?.label as string | undefined)?.trim();
  if (!label) return jsonError('label is required', 422);

  const [row] = await db
    .insert(projectSlots)
    .values({
      classId: params.classId,
      label,
      groupSize: body?.groupSize ?? 1,
      titlesRequiredMin: body?.titlesRequiredMin ?? 2,
      titlesAllowedMax: body?.titlesAllowedMax ?? 50,
      duplicateCheck: body?.duplicateCheck === 'strict' ? 'strict' : 'warn',
      deadline: body?.deadline ? new Date(body.deadline) : null,
      requireDeploymentUrl: !!body?.requireDeploymentUrl,
      requireTechStack: body?.requireTechStack ?? true,
      requireTargetUsers: !!body?.requireTargetUsers,
      locked: !!body?.locked,
    })
    .returning();

  // Auto-seed standard academic documentation field templates
  try {
    const standardFields = [
      { label: 'Abstract', fieldKey: 'abstract', fieldType: 'textarea', required: true, sortOrder: 0 },
      { label: 'Statement of the Problem', fieldKey: 'statement_of_problem', fieldType: 'textarea', required: true, sortOrder: 1 },
      { label: 'Scope & Limitations', fieldKey: 'scope_and_limitations', fieldType: 'textarea', required: false, sortOrder: 2 },
      { label: 'Key Objectives', fieldKey: 'key_objectives', fieldType: 'textarea', required: true, sortOrder: 3 },
    ];
    await db.insert(documentationFieldTemplates).values(
      standardFields.map((f) => ({
        slotId: row.id,
        ...f,
      }))
    );
  } catch (err) {
    console.error('Could not auto-seed documentation fields', err);
  }

  return NextResponse.json({ slot: row }, { status: 201 });
}
