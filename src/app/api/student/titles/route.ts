import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { groups, studentGroupSlots, titles } from '@/lib/schema';
import { and, eq, ilike } from 'drizzle-orm';
import { getStudentSession } from '@/lib/auth';
import { assertSlotInClass, jsonError } from '@/lib/helpers';
import { assertActionRateLimit } from '@/lib/rate-limit';
import { selectTitles } from '@/lib/titles-query';

// GET: titles belonging to the student's group for a slot
export async function GET(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const slotId = req.nextUrl.searchParams.get('slotId');
  if (!slotId) return jsonError('slotId is required', 422);

  const [membership] = await db
    .select()
    .from(studentGroupSlots)
    .where(and(eq(studentGroupSlots.studentId, session.studentId), eq(studentGroupSlots.slotId, slotId)))
    .limit(1);
  if (!membership) return NextResponse.json({ titles: [] });

  const rows = await selectTitles(eq(titles.groupId, membership.groupId));
  return NextResponse.json({ titles: rows });
}

// POST: submit a new title, with ILIKE duplicate check against titles in same class/slot
export async function POST(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const body = await req.json().catch(() => null);
  const slotId = body?.slotId as string | undefined;
  const text = (body?.text as string | undefined)?.trim();
  const description = (body?.description as string | undefined)?.trim();
  const techStack = Array.isArray(body?.techStack) ? (body.techStack as string[]) : [];
  const targetUsers = (body?.targetUsers as string | undefined)?.trim() || null;

  if (!slotId || !text || !description) {
    return jsonError('slotId, text and description are required', 422);
  }

  const slot = await assertSlotInClass(slotId, session.classId);
  if (!slot) return jsonError('Slot not found', 404);
  if (slot.locked) return jsonError('This project slot is locked', 409);

  const limited = await assertActionRateLimit({
    key: `student:${session.studentId}`,
    action: 'title_submit',
    max: 8,
    message: 'Too many title submissions. Wait a few minutes and try again.',
  });
  if (limited) return limited;

  const [membership] = await db
    .select({ membership: studentGroupSlots, group: groups })
    .from(studentGroupSlots)
    .innerJoin(groups, eq(groups.id, studentGroupSlots.groupId))
    .where(and(eq(studentGroupSlots.studentId, session.studentId), eq(studentGroupSlots.slotId, slotId)))
    .limit(1);
  if (!membership) return jsonError('You must belong to a group before submitting titles', 403);

  const existingTitles = await db
    .select({ id: titles.id })
    .from(titles)
    .where(eq(titles.groupId, membership.group.id));
  if (existingTitles.length >= slot.titlesAllowedMax) {
    return jsonError(`This group already has the maximum of ${slot.titlesAllowedMax} titles`, 409);
  }

  if (slot.requireTechStack && techStack.length === 0) {
    return jsonError('At least one tech stack tag is required', 422);
  }
  if (slot.requireTargetUsers && !targetUsers) {
    return jsonError('Target users is required', 422);
  }

  // Duplicate check via ILIKE against the `text` column, scoped to class + slot
  const matches = await db
    .select({ id: titles.id, text: titles.text })
    .from(titles)
    .where(and(eq(titles.classId, session.classId), eq(titles.slotId, slotId), ilike(titles.text, `%${text}%`)));

  if (matches.length > 0 && slot.duplicateCheck === 'strict') {
    return NextResponse.json(
      { error: 'A similar title already exists in this class', duplicates: matches },
      { status: 409 }
    );
  }

  const [row] = await db
    .insert(titles)
    .values({
      classId: session.classId,
      slotId,
      groupId: membership.group.id,
      text,
      description,
      techStack,
      targetUsers,
      addedBy: 'student',
      submittedByStudentId: session.studentId,
    })
    .returning();

  return NextResponse.json(
    { title: row, warnings: matches.length > 0 ? matches : undefined },
    { status: 201 }
  );
}
