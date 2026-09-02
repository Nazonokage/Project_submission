import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { classes } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { isUuid, jsonError } from '@/lib/helpers';

// Public: class name + term only, for the student login screen.
export async function GET(req: NextRequest) {
  const classId = req.nextUrl.searchParams.get('classId');
  if (!classId) return jsonError('classId is required', 422);
  if (!isUuid(classId)) return jsonError('Class not found', 404);

  const [row] = await db
    .select({ name: classes.name, term: classes.term })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  if (!row) return jsonError('Class not found', 404);
  return NextResponse.json({ class: row });
}
