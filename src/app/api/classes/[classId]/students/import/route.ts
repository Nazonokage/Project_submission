import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import {
  assertClassOwnedByProf,
  classDefaultPassword,
  jsonError,
  nextStudentIdNumber,
} from '@/lib/helpers';

// Body: { names: string[] } — one name per line, already split client-side,
// or { text: string } — raw .txt contents (one name per line).
export async function POST(req: NextRequest, { params }: { params: { classId: string } }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  const body = await req.json().catch(() => null);

  let names: string[] = [];
  if (Array.isArray(body?.names)) {
    names = body.names;
  } else if (typeof body?.text === 'string') {
    names = body.text.split('\n');
  } else {
    return jsonError('Provide "names" (array) or "text" (raw .txt contents)', 422);
  }

  names = names.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return jsonError('No names found', 422);

  const start = Number.parseInt(await nextStudentIdNumber(params.classId), 10);
  const password = classDefaultPassword(cls);
  const rows = names.map((name, i) => ({
    classId: params.classId,
    name,
    idNumber: String(start + i).padStart(4, '0'),
    password,
  }));

  try {
    const inserted = await db.insert(students).values(rows).returning();
    return NextResponse.json({ students: inserted, count: inserted.length }, { status: 201 });
  } catch (err: any) {
    if (String(err?.message || '').includes('unique')) {
      return jsonError('Import collided with an existing student ID. Try again.', 409);
    }
    throw err;
  }
}
