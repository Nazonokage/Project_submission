import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, assertStudentInClass, jsonError } from '@/lib/helpers';

type Params = { params: { classId: string; studentId: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  const student = await assertStudentInClass(params.studentId, params.classId);
  if (!student) return jsonError('Student not found', 404);

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};
  if (typeof body?.name === 'string') patch.name = body.name.trim();
  if (typeof body?.idNumber === 'string') patch.idNumber = body.idNumber.trim();
  if (typeof body?.password === 'string') patch.password = body.password.trim();

  if (Object.keys(patch).length === 0) return jsonError('Nothing to update', 422);

  try {
    const [row] = await db
      .update(students)
      .set(patch)
      .where(eq(students.id, params.studentId))
      .returning();
    return NextResponse.json({ student: row });
  } catch (err: any) {
    if (String(err?.message || '').includes('unique')) {
      return jsonError('A student with that ID number already exists in this class', 409);
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  const student = await assertStudentInClass(params.studentId, params.classId);
  if (!student) return jsonError('Student not found', 404);

  await db.delete(students).where(eq(students.id, params.studentId));
  return NextResponse.json({ ok: true });
}
