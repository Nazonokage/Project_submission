import { NextRequest, NextResponse } from 'next/server';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { feedback, students, studentGroupSlots, titleReports, titles } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, assertSlotInClass, jsonError } from '@/lib/helpers';
import { isSchemaDrift } from '@/lib/pg-errors';
import { selectTitles, titleConditions } from '@/lib/titles-query';

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function GET(req: NextRequest, { params }: { params: { classId: string; slotId: string } }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);
  const slot = await assertSlotInClass(params.slotId, params.classId);
  if (!slot) return jsonError('Slot not found', 404);

  const statusFilter = req.nextUrl.searchParams.get('status');
  const rows = await selectTitles(
    titleConditions([
      eq(titles.classId, params.classId),
      eq(titles.slotId, params.slotId),
      statusFilter ? eq(titles.status, statusFilter) : undefined,
    ])
  );

  const withMembers = await Promise.all(
    rows.map(async (t) => {
      const members = await db
        .select({ name: students.name, idNumber: students.idNumber })
        .from(studentGroupSlots)
        .innerJoin(students, eq(students.id, studentGroupSlots.studentId))
        .where(eq(studentGroupSlots.groupId, t.groupId));
      return { ...t, members };
    })
  );

  const titleIds = withMembers.map((t) => t.id);
  const latestReports = new Map<string, (typeof titleReports.$inferSelect)>();
  const feedbackSummary = new Map<string, { count: number; latest: string | null }>();

  if (titleIds.length > 0) {
    try {
      const reports = await db
        .select()
        .from(titleReports)
        .where(inArray(titleReports.titleId, titleIds))
        .orderBy(desc(titleReports.createdAt));
      for (const r of reports) {
        if (!latestReports.has(r.titleId)) latestReports.set(r.titleId, r);
      }
    } catch (err) {
      if (!isSchemaDrift(err)) throw err;
    }
    try {
      const notes = await db
        .select()
        .from(feedback)
        .where(inArray(feedback.titleId, titleIds))
        .orderBy(desc(feedback.createdAt));
      for (const n of notes) {
        if (!n.titleId) continue;
        const cur = feedbackSummary.get(n.titleId) || { count: 0, latest: null };
        cur.count += 1;
        if (!cur.latest) cur.latest = `${n.type}: ${n.body}`;
        feedbackSummary.set(n.titleId, cur);
      }
    } catch (err) {
      if (!isSchemaDrift(err)) throw err;
    }
  }

  const header = [
    'Group members',
    'Title',
    'Status',
    'Progress',
    'Repo URL',
    'Deployment URL',
    'Latest version',
    'Report notes',
    'Feedback count',
    'Latest feedback',
    'Submitted',
    'Verified',
    'Updated',
  ];

  const lines = [header.join(',')];
  for (const t of withMembers) {
    const report = latestReports.get(t.id);
    const fb = feedbackSummary.get(t.id);
    lines.push(
      [
        t.members.map((m) => `${m.name} (${m.idNumber})`).join('; '),
        t.text,
        t.status,
        t.progressStatus || 'planning',
        report?.repoUrl || t.repoUrl || '',
        report?.deploymentUrl || t.deploymentUrl || '',
        report?.version || '',
        report?.progressSummary || report?.changelog || '',
        fb?.count ?? 0,
        fb?.latest || '',
        t.createdAt,
        t.verifiedAt || '',
        t.updatedAt,
      ]
        .map(csvCell)
        .join(',')
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${(slot.label || 'slot').replace(/[^\w.-]+/g, '_')}-${stamp}.csv`;
  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
