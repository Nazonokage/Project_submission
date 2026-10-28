import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { studentGroupSlots } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, assertSlotInClass, assertStudentInClass, jsonError } from '@/lib/helpers';
import { pgErrorCode } from '@/lib/pg-errors';

type Context = { params: { classId: string; studentId: string } };
export async function POST(req: NextRequest, { params }: Context) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);
  if (!await assertClassOwnedByProf(params.classId, prof.profId)) return jsonError('Class not found', 404);
  if (!await assertStudentInClass(params.studentId, params.classId)) return jsonError('Student not found', 404);
  const body = await req.json().catch(() => null);
  const memberIds = body?.memberIds ?? [];
  if (typeof body?.slotId !== 'string' || !Array.isArray(memberIds) || memberIds.some((id: unknown) => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return jsonError('Choose a project slot and valid classmates', 422);
  const slot = await assertSlotInClass(body.slotId, params.classId);
  if (!slot) return jsonError('Slot not found', 404);
  const wanted = [...new Set<string>([params.studentId, ...memberIds])];
  if (wanted.length > slot.groupSize) return jsonError(`This slot allows at most ${slot.groupSize} members`, 422);
  const [membership] = await db.select().from(studentGroupSlots).where(and(eq(studentGroupSlots.studentId, params.studentId), eq(studentGroupSlots.slotId, slot.id))).limit(1);
  const groupId = membership?.groupId || randomUUID();
  const ids = sql`ARRAY[${sql.join(wanted.map(id => sql`${id}`), sql`, `)}]::uuid[]`;
  // A single atomic statement creates/extends the group and joins everyone. A
  // uniqueness conflict rolls back the entire change, never leaving an orphan.
  const change = sql`
    WITH requested AS (SELECT unnest(${ids}) AS student_id),
    eligible AS (
      SELECT p.group_size FROM project_slots p
      WHERE p.id = ${slot.id}::uuid AND p.class_id = ${params.classId}::uuid
      AND NOT EXISTS (SELECT 1 FROM requested r LEFT JOIN students s ON s.id = r.student_id AND s.class_id = p.class_id WHERE s.id IS NULL)
      AND NOT EXISTS (SELECT 1 FROM student_group_slots m JOIN requested r ON r.student_id = m.student_id WHERE m.slot_id = p.id AND m.group_id <> ${groupId}::uuid)
      AND (SELECT count(*) FROM (SELECT student_id FROM requested UNION SELECT student_id FROM student_group_slots WHERE group_id = ${groupId}::uuid) all_members)
        + (SELECT count(*) FROM group_invites i WHERE i.group_id = ${groupId}::uuid AND i.status = 'pending' AND NOT (i.invited_student_id = ANY(${ids}))) <= p.group_size
    ),
    target AS (
      INSERT INTO groups (id, class_id, slot_id, status, max_size)
      SELECT ${groupId}::uuid, ${params.classId}::uuid, ${slot.id}::uuid, 'forming', group_size FROM eligible
      ON CONFLICT (id) DO UPDATE SET max_size = EXCLUDED.max_size, updated_at = now()
      RETURNING id
    ),
    joined AS (
      INSERT INTO student_group_slots (student_id, group_id, slot_id)
      SELECT r.student_id, t.id, ${slot.id}::uuid FROM requested r CROSS JOIN target t
      WHERE NOT EXISTS (SELECT 1 FROM student_group_slots m WHERE m.student_id = r.student_id AND m.slot_id = ${slot.id}::uuid)
      RETURNING student_id
    ),
    invitations AS (
      UPDATE group_invites SET status = 'declined' WHERE slot_id = ${slot.id}::uuid AND status = 'pending'
      AND invited_student_id IN (SELECT student_id FROM joined) RETURNING id
    )
    SELECT id AS "groupId" FROM target`;
  try {
    // Serialize professor membership changes for this slot; each batch is a transaction.
    const results = await db.batch([
      db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${params.classId + ':' + slot.id}))`),
      db.execute(change),
      db.execute(sql`UPDATE groups SET status = CASE WHEN (SELECT count(*) FROM student_group_slots WHERE group_id = ${groupId}::uuid) >= max_size THEN 'locked' ELSE 'forming' END WHERE id = ${groupId}::uuid`),
    ]);
    if (!results[1].rows.length) return jsonError('A classmate is unavailable or the group has no free seats. Refresh and try again.', 409);
    return NextResponse.json({ groupId, slotId: slot.id }, { status: membership ? 200 : 201 });
  } catch (err) {
    if (pgErrorCode(err) === '23505') return jsonError('A student joined another group. Refresh and try again.', 409);
    throw err;
  }
}
