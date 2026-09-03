import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { classes, students } from '@/lib/schema';
import { eq, asc } from 'drizzle-orm';
import { isUuid, jsonError } from '@/lib/helpers';

/** Public roster for the class login combobox — names and ID numbers only. */
export async function GET(_req: NextRequest, { params }: { params: { classId: string } }) {
  if (!isUuid(params.classId)) return jsonError('Class not found', 404);

  const [cls] = await db.select({ id: classes.id }).from(classes).where(eq(classes.id, params.classId)).limit(1);
  if (!cls) return jsonError('Class not found', 404);

  const rows = await db
    .select({ name: students.name, idNumber: students.idNumber })
    .from(students)
    .where(eq(students.classId, params.classId))
    .orderBy(asc(students.name));

  return NextResponse.json({ students: rows });
}
