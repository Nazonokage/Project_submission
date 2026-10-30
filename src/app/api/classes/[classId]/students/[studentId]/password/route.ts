import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { students, rateLimits } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, assertStudentInClass, classDefaultPassword, isUuid, jsonError } from '@/lib/helpers';
import { hashPassword, recoverStudentPassword } from '@/lib/password';
import { encryptStudentPassword } from '@/lib/password-vault.mjs';
import { assertActionRateLimit, rateKey } from '@/lib/rate-limit';

export async function POST(req: NextRequest, { params }: { params: Promise<{ classId: string; studentId: string }> }) {
  const { classId, studentId } = await params;
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);
  if (!isUuid(classId) || !isUuid(studentId)) return jsonError('Student not found', 404);
  const cls = await assertClassOwnedByProf(classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);
  const student = await assertStudentInClass(studentId, classId);
  if (!student) return jsonError('Student not found', 404);
  const body = await req.json().catch(() => null);
  if (!['reveal', 'reset'].includes(body?.action)) return jsonError('Choose show or issue a password', 422);
  const limited = await assertActionRateLimit({ key: `${prof.profId}:${studentId}`, action: 'password_recovery', max: 30, message: 'Too many password recovery attempts. Try again later.' });
  if (limited) return limited;
  const headers = { 'Cache-Control': 'no-store, max-age=0' };
  if (body.action === 'reveal') {
    const candidate = await recoverStudentPassword(student, cls);
    if (candidate === null) {
      return jsonError('This password cannot be shown. Issue a new password for this student.', 409);
    }
    return NextResponse.json({ password: candidate }, { headers });
  }
  if (!student.isActive) return jsonError('This student is inactive. Reactivate the account before issuing a password.', 409);
  const password = classDefaultPassword(cls);
  const hash = await hashPassword(password);
  const bucket = rateKey(`${classId}:${student.idNumber}`);
  await db.batch([
    db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${bucket + ':student_login'}))`),
    db.update(students).set({ password: hash,
      passwordEncrypted: encryptStudentPassword(password, { studentId, classId, passwordHash: hash }),
    }).where(and(eq(students.id, studentId), eq(students.classId, classId))),
    db.delete(rateLimits).where(and(eq(rateLimits.key, bucket), eq(rateLimits.action, 'student_login'))),
  ]);
  return NextResponse.json({ password, replaced: true }, { headers });
}
