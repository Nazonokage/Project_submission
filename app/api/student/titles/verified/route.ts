import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { titles, groups, students, studentGroupSlots } from '@/lib/schema';
import { and, eq, or, ilike, sql } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

// GET verified titles for a slot within the student's own class, with optional search
export async function GET(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const slotId = req.nextUrl.searchParams.get('slotId');
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!slotId) return jsonError('slotId is required', 422);

  const conditions = [
    eq(titles.classId, session.classId),
    eq(titles.slotId, slotId),
    eq(titles.status, 'verified'),
  ];

  if (q) {
    conditions.push(
      or(
        ilike(titles.text, `%${q}%`),
        ilike(titles.description, `%${q}%`),
        ilike(titles.targetUsers, `%${q}%`),
        sql`EXISTS (SELECT 1 FROM unnest(${titles.techStack}) tag WHERE tag ILIKE ${'%' + q + '%'})`
      )!
    );
  }

  const rows = await db
    .select()
    .from(titles)
    .where(and(...conditions));

  // Attach group member names for display
  const withMembers = await Promise.all(
    rows.map(async (t) => {
      const members = await db
        .select({ name: students.name })
        .from(studentGroupSlots)
        .innerJoin(students, eq(students.id, studentGroupSlots.studentId))
        .where(eq(studentGroupSlots.groupId, t.groupId));
      return { ...t, members: members.map((m) => m.name) };
    })
  );

  return NextResponse.json({ titles: withMembers });
}
