import { NextResponse } from 'next/server';
import { db } from './db';
import { classes, projectSlots, groups, students } from './schema';
import { and, eq } from 'drizzle-orm';

export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generatePassword(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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

// Confirms this student belongs to this class.
export async function assertStudentInClass(studentId: string, classId: string) {
  const [row] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.classId, classId)))
    .limit(1);
  return row ?? null;
}
