import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students } from '@/lib/schema';
import { eq, asc } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, generatePassword, jsonError } from '@/lib/helpers';

export async function GET(_req: NextRequest, { params }: { params: { classId: string } }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  const rows = await db
    .select()
    .from(students)
    .where(eq(students.classId, params.classId))
    .orderBy(asc(students.name));

  return NextResponse.json({ students: rows });
}

export async function POST(req: NextRequest, { params }: { params: { classId: string } }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  const idNumber = (body?.idNumber as string | undefined)?.trim();
  const password = (body?.password as string | undefined)?.trim() || generatePassword();

  if (!name || !idNumber) return jsonError('name and idNumber are required', 422);

  try {
    const [row] = await db
      .insert(students)
      .values({ classId: params.classId, name, idNumber, password })
      .returning();
    return NextResponse.json({ student: row }, { status: 201 });
  } catch (err: any) {
    if (String(err?.message || '').includes('unique')) {
      return jsonError('A student with that ID number already exists in this class', 409);
    }
    throw err;
  }
}
