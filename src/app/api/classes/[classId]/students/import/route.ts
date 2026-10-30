import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { hashPassword, publicStudent } from '@/lib/password';
import { encryptStudentPassword } from '@/lib/password-vault.mjs';
import { randomUUID } from 'node:crypto';
import {
  assertClassOwnedByProf,
  classDefaultPassword,
  jsonError,
  nextStudentIdNumber,
} from '@/lib/helpers';

// Body: { names: string[] } — one name per line, already split client-side,
// or { text: string } — raw .txt contents (one name per line).
export async function POST(req: NextRequest, { params: promisedParams }: { params: Promise<{ classId: string }> }) {
  const params = await promisedParams;
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

  if (names.some(n => typeof n !== 'string')) return jsonError('Names must be text', 422);
  names = names.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return jsonError('No names found', 422);
  if (names.length > 100 || names.some(n => n.length > 200)) return jsonError('Import at most 100 names of up to 200 characters at a time', 422);

  const start = Number.parseInt(await nextStudentIdNumber(params.classId), 10);
  const credentials = names.map((name, i) => ({ name, idNumber: String(start + i).padStart(4, '0'), initialPassword: classDefaultPassword(cls) }));
  const rows = [];
  for (const credential of credentials) {
    const id = randomUUID();
    const hash = await hashPassword(credential.initialPassword);
    rows.push({
    id,
    classId: params.classId,
    name: credential.name,
    idNumber: credential.idNumber,
    password: hash,
    passwordEncrypted: encryptStudentPassword(credential.initialPassword, { studentId: id, classId: params.classId, passwordHash: hash }),
    });
  }

  try {
    const inserted = await db.insert(students).values(rows).returning();
    return NextResponse.json({ students: inserted.map(publicStudent), credentials, count: inserted.length }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    if (String(err?.message || '').includes('unique')) {
      return jsonError('Import collided with an existing student ID. Try again.', 409);
    }
    throw err;
  }
}
