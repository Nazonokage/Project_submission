import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { classes } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, jsonError } from '@/lib/helpers';

type Params = { params: { classId: string } };

export async function GET(_req: Request, { params }: Params) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  return NextResponse.json({ class: cls });
}

export async function PATCH(req: Request, { params }: Params) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  const body = await req.json().catch(() => null);
  const patch: { defaultStudentPassword?: string; name?: string; term?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (typeof body?.defaultStudentPassword === 'string') {
    const value = body.defaultStudentPassword.trim();
    if (!value) return jsonError('defaultStudentPassword cannot be empty', 422);
    patch.defaultStudentPassword = value;
  }
  if (typeof body?.name === 'string') {
    const value = body.name.trim();
    if (!value) return jsonError('name cannot be empty', 422);
    patch.name = value;
  }
  if (typeof body?.term === 'string') {
    const value = body.term.trim();
    if (!value) return jsonError('term cannot be empty', 422);
    patch.term = value;
  }

  if (Object.keys(patch).length === 1) return jsonError('Nothing to update', 422);

  const [row] = await db.update(classes).set(patch).where(eq(classes.id, params.classId)).returning();
  return NextResponse.json({ class: row });
}
