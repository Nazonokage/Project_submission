import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, studentGroupSlots, projectSlots, titles } from '@/lib/schema';
import { eq, asc, and, isNull, desc } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import {
  assertClassOwnedByProf,
  classDefaultPassword,
  jsonError,
  nextStudentIdNumber,
} from '@/lib/helpers';

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

  const memberships = await db
    .select({
      studentId: studentGroupSlots.studentId,
      groupId: studentGroupSlots.groupId,
      slotId: studentGroupSlots.slotId,
    })
    .from(studentGroupSlots)
    .innerJoin(students, eq(students.id, studentGroupSlots.studentId))
    .where(eq(students.classId, params.classId));

  const byStudent = new Map<string, { groupId: string; slotId: string }[]>();
  for (const m of memberships) {
    const list = byStudent.get(m.studentId) || [];
    list.push({ groupId: m.groupId, slotId: m.slotId });
    byStudent.set(m.studentId, list);
  }

  const studentById = new Map(rows.map((student) => [student.id, student]));
  const membersByGroupSlot = new Map<string, { id: string; name: string; idNumber: string }[]>();
  for (const membership of memberships) {
    const student = studentById.get(membership.studentId);
    if (!student) continue;
    const key = `${membership.groupId}:${membership.slotId}`;
    const members = membersByGroupSlot.get(key) || [];
    members.push({ id: student.id, name: student.name, idNumber: student.idNumber });
    membersByGroupSlot.set(key, members);
  }
  const slots = await db.select({ id: projectSlots.id, label: projectSlots.label, excludedStudentIds: projectSlots.excludedStudentIds })
    .from(projectSlots).where(eq(projectSlots.classId, params.classId)).orderBy(asc(projectSlots.createdAt));
  const classTitles = await db.select({ id: titles.id, groupId: titles.groupId, slotId: titles.slotId, status: titles.status, text: titles.text })
    .from(titles).where(and(eq(titles.classId, params.classId), isNull(titles.deletedAt))).orderBy(desc(titles.createdAt));
  const byGroupSlot = new Map<string, typeof classTitles>();
  for (const title of classTitles) {
    const key = `${title.groupId}:${title.slotId}`;
    const list = byGroupSlot.get(key) || [];
    list.push(title);
    byGroupSlot.set(key, list);
  }
  return NextResponse.json({
    slots,
    students: rows.map((s) => {
      const memberships = byStudent.get(s.id) || [];
      return { ...s, memberships, slotProgress: slots.map((slot) => {
        const membership = memberships.find((m) => m.slotId === slot.id);
        const work = membership ? byGroupSlot.get(`${membership.groupId}:${slot.id}`) || [] : [];
        return {
          slotId: slot.id, slotLabel: slot.label, inGroup: !!membership, groupId: membership?.groupId || null,
          enrolled: !slot.excludedStudentIds?.includes(s.id),
          members: membership ? membersByGroupSlot.get(`${membership.groupId}:${slot.id}`) || [] : [],
          titles: work.map((title) => ({ id: title.id, text: title.text, status: title.status })),
          pendingCount: work.filter((t) => t.status === 'pending').length,
          verifiedCount: work.filter((t) => t.status === 'verified').length,
          rejectedCount: work.filter((t) => t.status === 'rejected').length,
          latestTitleText: work[0]?.text || null, latestTitleStatus: work[0]?.status || null,
        };
      }) };
    }),
  });
}

export async function POST(req: NextRequest, { params }: { params: { classId: string } }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  const idNumber =
    (body?.idNumber as string | undefined)?.trim() || (await nextStudentIdNumber(params.classId));
  const password =
    (body?.password as string | undefined)?.trim() || classDefaultPassword(cls);

  if (!name) return jsonError('name is required', 422);

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
