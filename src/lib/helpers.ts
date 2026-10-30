import { NextResponse } from 'next/server';
import { randomInt, randomBytes } from 'node:crypto';
import { db } from './db';
import { classes, projectSlots, groups, students, professorOtps } from './schema';
import { and, eq, lt, or } from 'drizzle-orm';

export function generateOtp() {
  return randomInt(100000, 1000000).toString();
}

export async function cleanupProfessorOtps() {
  await db
    .delete(professorOtps)
    .where(or(eq(professorOtps.used, true), lt(professorOtps.expiresAt, new Date())));
}

export function generatePassword() {
  return randomBytes(18).toString('base64url');
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// Confirms this class belongs to this prof. Returns the class row or null.
export async function assertClassOwnedByProf(classId: string, profId: string) {
  const [row] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.profId, profId)))
    .limit(1);
  return row ?? null;
}

// Confirms this slot belongs to this class.
export async function assertSlotInClass(slotId: string, classId: string) {
  const [row] = await db
    .select()
    .from(projectSlots)
    .where(and(eq(projectSlots.id, slotId), eq(projectSlots.classId, classId)))
    .limit(1);
  return row ?? null;
}

// Confirms this group belongs to this class + slot.
export async function assertGroupInClassSlot(groupId: string, classId: string, slotId: string) {
  const [row] = await db
    .select()
    .from(groups)
    .where(
      and(eq(groups.id, groupId), eq(groups.classId, classId), eq(groups.slotId, slotId))
    )
    .limit(1);
  return row ?? null;
}

export async function nextStudentIdNumber(classId: string): Promise<string> {
  const rows = await db
    .select({ idNumber: students.idNumber })
    .from(students)
    .where(eq(students.classId, classId));

  let max = 0;
  for (const row of rows) {
    const raw = row.idNumber?.trim() ?? '';
    if (!/^\d+$/.test(raw)) continue;
    const n = Number.parseInt(raw, 10);
    if (n > max) max = n;
  }

  return String(max + 1).padStart(4, '0');
}

export function classDefaultPassword(_cls?: unknown) {
  return '2026';
}

// Confirms this student belongs to this class.
export async function assertStudentInClass(studentId: string, classId: string) {
  const [row] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.classId, classId)))
    .limit(1);
  return row ?? null;
}
