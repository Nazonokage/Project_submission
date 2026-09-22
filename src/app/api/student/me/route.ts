import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, studentGroupSlots, groups, projectSlots } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';
import { verifyStoredPassword } from '@/lib/password';

const MIN_PASSWORD_LENGTH = 4;

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

  const currentPassword = (body?.currentPassword as string | undefined)?.trim();
  const newPassword = (body?.newPassword as string | undefined)?.trim();

  if (!currentPassword || !newPassword) {
    return jsonError('currentPassword and newPassword are required', 422);
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return jsonError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`, 422);
  }

  const ok = await verifyStoredPassword(currentPassword, student.password || '');
  if (!ok) return jsonError('Current password is incorrect', 401);

  await db.update(students).set({ password: newPassword }).where(eq(students.id, session.studentId));
  return NextResponse.json({ ok: true });
}
