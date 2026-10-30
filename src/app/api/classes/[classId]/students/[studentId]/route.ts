import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  students,
  studentGroupSlots,
  groups,
  projectSlots,
  titles,
  groupLeaveRequests,
} from '@/lib/schema';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, assertStudentInClass, jsonError } from '@/lib/helpers';
import { isSchemaDrift } from '@/lib/pg-errors';
import { hashPassword, issuedPasswordError, publicStudent } from '@/lib/password';
import { encryptStudentPassword } from '@/lib/password-vault.mjs';

type Params = { params: Promise<{ classId: string; studentId: string }> };

async function requireOwnedStudent(params: Awaited<Params['params']>) {
  const prof = await getProfSession();
  if (!prof) return { ok: false as const, error: jsonError('Not authenticated', 401) };
  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return { ok: false as const, error: jsonError('Class not found', 404) };
  const student = await assertStudentInClass(params.studentId, params.classId);
  if (!student) return { ok: false as const, error: jsonError('Student not found', 404) };
  return { ok: true as const, student, cls };
}

export async function GET(_req: NextRequest, { params: promisedParams }: Params) {
  const params = await promisedParams;
  const auth = await requireOwnedStudent(params);
  if (!auth.ok) return auth.error;
  const { student } = auth;

  const membershipRows = await db
    .select({
      groupId: groups.id,
      groupStatus: groups.status,
      slotId: projectSlots.id,
      slotLabel: projectSlots.label,
      maxSize: projectSlots.groupSize,
    })
    .from(studentGroupSlots)
    .innerJoin(groups, eq(groups.id, studentGroupSlots.groupId))
    .innerJoin(projectSlots, eq(projectSlots.id, studentGroupSlots.slotId))
    .where(eq(studentGroupSlots.studentId, params.studentId));

  const groupIds = membershipRows.map((m) => m.groupId);
  const membersByGroup = new Map<string, { id: string; name: string; idNumber: string }[]>();

  if (groupIds.length > 0) {
    const memberRows = await db
      .select({
        groupId: studentGroupSlots.groupId,
        id: students.id,
        name: students.name,
        idNumber: students.idNumber,
      })
      .from(studentGroupSlots)
      .innerJoin(students, eq(students.id, studentGroupSlots.studentId))
      .where(inArray(studentGroupSlots.groupId, groupIds));

    for (const row of memberRows) {
      const list = membersByGroup.get(row.groupId) || [];
      list.push({ id: row.id, name: row.name, idNumber: row.idNumber });
      membersByGroup.set(row.groupId, list);
    }
  }

  const memberships = membershipRows.map((m) => ({
    groupId: m.groupId,
    status: m.groupStatus,
    slotId: m.slotId,
    slotLabel: m.slotLabel,
    maxSize: m.maxSize,
    members: membersByGroup.get(m.groupId) || [],
  }));

  const slots = await db.select({ id: projectSlots.id, excludedStudentIds: projectSlots.excludedStudentIds }).from(projectSlots).where(eq(projectSlots.classId, params.classId));
  const unassignedSlotIds = slots.filter(slot => !slot.excludedStudentIds?.includes(params.studentId) && !memberships.some(m => m.slotId === slot.id)).map(slot => slot.id);

  const titleRows =
    groupIds.length === 0
      ? []
      : await db
          .select({
            id: titles.id,
            text: titles.text,
            status: titles.status,
            groupId: titles.groupId,
            slotId: titles.slotId,
          })
          .from(titles)
          .where(and(inArray(titles.groupId, groupIds), isNull(titles.deletedAt)));

  let leaveRequests: (typeof groupLeaveRequests.$inferSelect)[] = [];
  try {
    leaveRequests = await db
      .select()
      .from(groupLeaveRequests)
      .where(eq(groupLeaveRequests.studentId, params.studentId));
  } catch (err) {
    if (!isSchemaDrift(err)) console.error('Could not load leave requests', err);
  }

  return NextResponse.json({
    class: { name: auth.cls.name, term: auth.cls.term },
    student: publicStudent(student),
    memberships,
    unassignedSlotIds,
    hasEligibleSlots: slots.some(slot => !slot.excludedStudentIds?.includes(params.studentId)),
    titles: titleRows,
    leaveRequests,
  });
}

export async function PATCH(req: NextRequest, { params: promisedParams }: Params) {
  const params = await promisedParams;
  const auth = await requireOwnedStudent(params);
  if (!auth.ok) return auth.error;

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = {};
  if (typeof body?.name === 'string') patch.name = body.name.trim();
  if (typeof body?.idNumber === 'string') patch.idNumber = body.idNumber.trim();
  if (typeof body?.password === 'string' && body.password) {
    const invalid = issuedPasswordError(body.password);
    if (invalid) return jsonError(invalid, 422);
    patch.password = await hashPassword(body.password);
    patch.passwordEncrypted = encryptStudentPassword(body.password, { studentId: params.studentId, classId: params.classId, passwordHash: patch.password });
  }
  if (typeof body?.isActive === 'boolean') patch.isActive = body.isActive;

  if (Object.keys(patch).length === 0) return jsonError('Nothing to update', 422);
  if (typeof patch.name === 'string' && !patch.name) return jsonError('name cannot be empty', 422);
  if (typeof patch.idNumber === 'string' && !patch.idNumber) return jsonError('idNumber cannot be empty', 422);
  if (typeof patch.password === 'string' && !patch.password) return jsonError('password cannot be empty', 422);

  try {
    const [row] = await db
      .update(students)
      .set(patch)
      .where(eq(students.id, params.studentId))
      .returning();
    return NextResponse.json({ student: publicStudent(row) });
  } catch (err: any) {
    if (String(err?.message || '').includes('unique')) {
      return jsonError('A student with that ID number already exists in this class', 409);
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params: promisedParams }: Params) {
  const params = await promisedParams;
  const auth = await requireOwnedStudent(params);
  if (!auth.ok) return auth.error;

  await db.delete(students).where(eq(students.id, params.studentId));
  await db.update(projectSlots).set({ excludedStudentIds: sql`array_remove(${projectSlots.excludedStudentIds}, ${params.studentId}::uuid)` }).where(eq(projectSlots.classId, params.classId));
  return NextResponse.json({ ok: true });
}
