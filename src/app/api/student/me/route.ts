import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, studentGroupSlots, groups, projectSlots } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getStudentSession, clearStudentCookie } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';
import { verifyStoredPassword, hashPassword, passwordError } from '@/lib/password';
import { assertActionRateLimit } from '@/lib/rate-limit';
import { encryptStudentPassword } from '@/lib/password-vault.mjs';


export async function GET() {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const [student] = await db
    .select({
      id: students.id,
      name: students.name,
      idNumber: students.idNumber,
      lastLoginAt: students.lastLoginAt,
      isActive: students.isActive,
      classId: students.classId,
    })
    .from(students)
    .where(eq(students.id, session.studentId))
    .limit(1);

  if (!student) return jsonError('Student not found', 404);

  const membershipRows = await db
    .select({
      groupId: groups.id,
      groupStatus: groups.status,
      slotId: projectSlots.id,
      slotLabel: projectSlots.label,
    })
    .from(studentGroupSlots)
    .innerJoin(groups, eq(groups.id, studentGroupSlots.groupId))
    .innerJoin(projectSlots, eq(projectSlots.id, studentGroupSlots.slotId))
    .where(eq(studentGroupSlots.studentId, session.studentId));

  return NextResponse.json({
    id: student.id,
    name: student.name,
    idNumber: student.idNumber,
    lastLoginAt: student.lastLoginAt,
    isActive: student.isActive,
    classId: student.classId,
    memberships: membershipRows.map((m) => ({
      groupId: m.groupId,
      status: m.groupStatus,
      slotId: m.slotId,
      slotLabel: m.slotLabel,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const [student] = await db.select().from(students).where(eq(students.id, session.studentId)).limit(1);
  if (!student) return jsonError('Student not found', 404);

  const body = await req.json().catch(() => null);
  if (body?.name != null || body?.idNumber != null) {
    return jsonError('Name and ID number cannot be changed here', 403);
  }

  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return jsonError('currentPassword and newPassword are required', 422);
  }
  const invalid = passwordError(newPassword);
  if (invalid) return jsonError(invalid, 422);
  const limited = await assertActionRateLimit({ key: session.studentId, action: 'password_change', max: 5, message: 'Too many password change attempts. Try again later.' });
  if (limited) return limited;

  const ok = await verifyStoredPassword(currentPassword, student.password || '');
  if (!ok) return jsonError('Current password is incorrect', 401);

  const hash = await hashPassword(newPassword);
  await db.update(students).set({ password: hash,
    passwordEncrypted: encryptStudentPassword(newPassword, { studentId: student.id, classId: student.classId, passwordHash: hash }),
  }).where(eq(students.id, session.studentId));
  await clearStudentCookie();
  return NextResponse.json({ ok: true });
}
