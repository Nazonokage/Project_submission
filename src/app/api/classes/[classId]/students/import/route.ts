import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, generatePassword, jsonError } from '@/lib/helpers';
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

  // Auto-generate a simple sequential ID number + random password per student.
  // Prof can edit both afterward.
  const rows = names.map((name, i) => ({
    classId: params.classId,
    name,
    idNumber: String(i + 1).padStart(4, '0'),
    password: generatePassword(),
  }));

  const inserted = await db.insert(students).values(rows).returning();

  return NextResponse.json({ students: inserted, count: inserted.length }, { status: 201 });
}
