import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { jsonError } from '@/lib/helpers';
import { signStudentToken, setStudentCookie } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const classId = body?.classId as string | undefined;
  const idNumber = (body?.idNumber as string | undefined)?.trim();
  const password = (body?.password as string | undefined)?.trim();

  if (!classId || !idNumber || !password) {
    return jsonError('classId, idNumber and password are required', 422);
  }

  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.classId, classId), eq(students.idNumber, idNumber)))
    .limit(1);

  if (!student) return jsonError('Invalid ID number or password', 401);

  const stored = student.password || '';
  const passwordOk = stored.startsWith('$2')
    ? await verifyPassword(password, stored)
    : stored === password;
  if (!passwordOk) return jsonError('Invalid ID number or password', 401);

  const token = await signStudentToken({ studentId: student.id, classId });
  await setStudentCookie(token);

  return NextResponse.json({ ok: true, student: { id: student.id, name: student.name } });
}
