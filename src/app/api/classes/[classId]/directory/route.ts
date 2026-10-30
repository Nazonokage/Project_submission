import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { classes, students } from '@/lib/schema';
import { and, eq, asc, or, sql } from 'drizzle-orm';
import { isUuid, jsonError } from '@/lib/helpers';

/** Public login search: active students' names and login IDs only. */
// This list changes whenever a professor imports or adds students. Never serve a
// previously generated roster to the login screen.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest, { params: promisedParams }: { params: Promise<{ classId: string }> }) {
  const params = await promisedParams;
  if (!isUuid(params.classId)) return jsonError('Class not found', 404);
  const query = req.nextUrl.searchParams.get('q')?.trim() || '';
  const headers = { 'Cache-Control': 'no-store, max-age=0' };
  if (query.length < 2) return NextResponse.json({ students: [] }, { headers });
  if (query.length > 100) return jsonError('Search must be at most 100 characters', 422);

  const [cls] = await db.select({ id: classes.id }).from(classes).where(eq(classes.id, params.classId)).limit(1);
  if (!cls) return jsonError('Class not found', 404);

  const rows = await db
    .select({ name: students.name, idNumber: students.idNumber })
    .from(students)
    .where(and(eq(students.classId, params.classId), eq(students.isActive, true), or(
      sql`strpos(lower(${students.name}), lower(${query})) > 0`,
      sql`strpos(lower(${students.idNumber}), lower(${query})) > 0`
    )))
    .orderBy(asc(students.name), asc(students.idNumber))
    .limit(20);

  return NextResponse.json(
    { students: rows },
    { headers }
  );
}
