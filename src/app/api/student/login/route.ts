import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { jsonError } from '@/lib/helpers';
import { signStudentToken, setStudentCookie, studentCredentialVersion } from '@/lib/auth';
import { assertActionRateLimit } from '@/lib/rate-limit';
import { verifyStoredPassword } from '@/lib/password';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const classId = typeof body?.classId === 'string' ? body.classId : '';
  const idNumber = typeof body?.idNumber === 'string' ? body.idNumber.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!classId || !idNumber || !password) {
    return jsonError('classId, idNumber and password are required', 422);
  }
  if (idNumber.length > 100 || password.length > 256) return jsonError('Invalid credentials', 422);
  const message = 'Too many login attempts. Try again in 15 minutes.';
  const globalLimit = await assertActionRateLimit({ key: 'student-login-service', action: 'login', max: 1000, message });
  if (globalLimit) return globalLimit;
  const limited = await assertActionRateLimit({ key: `${classId}:${idNumber}`, action: 'student_login', max: 10, message });
  if (limited) return limited;

  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.classId, classId), eq(students.idNumber, idNumber)))
    .limit(1);

  if (!student || !student.isActive) return jsonError('Invalid ID number or password', 401);

  const passwordOk = await verifyStoredPassword(password, student.password || '');
  if (!passwordOk) return jsonError('Invalid ID number or password', 401);

  await db.update(students).set({ lastLoginAt: new Date() }).where(eq(students.id, student.id));

  const token = await signStudentToken({ studentId: student.id, classId, credentialVersion: studentCredentialVersion(student.password) }, body?.rememberMe === true);
  await setStudentCookie(token, body?.rememberMe === true);

  return NextResponse.json({ ok: true, student: { id: student.id, name: student.name } });
}
