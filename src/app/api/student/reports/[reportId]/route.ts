import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { studentGroupSlots, titleReports } from '@/lib/schema';
import { getStudentSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';
import { isSchemaDrift } from '@/lib/pg-errors';

export async function PATCH(req: NextRequest, { params }: { params: { reportId: string } }) {
  const session = await getStudentSession();
  if (!session) return jsonError('Not authenticated', 401);

  const body = await req.json().catch(() => null);

  try {
    const [report] = await db.select().from(titleReports).where(eq(titleReports.id, params.reportId)).limit(1);
    if (!report) return jsonError('Report not found', 404);
    if (report.classId !== session.classId) return jsonError('Not authorized', 403);
    if (!report.isEditable) return jsonError('This report is locked by your professor', 409);

    const [membership] = await db
      .select()
      .from(studentGroupSlots)
      .where(
        and(eq(studentGroupSlots.studentId, session.studentId), eq(studentGroupSlots.groupId, report.groupId))
      )
      .limit(1);
    if (!membership) return jsonError('Only group members can edit this report', 403);

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body?.version === 'string') patch.version = body.version.trim();
    if (typeof body?.changelog === 'string') patch.changelog = body.changelog.trim();
    if (typeof body?.progressSummary === 'string') patch.progressSummary = body.progressSummary.trim();
    if (typeof body?.repoUrl === 'string') patch.repoUrl = body.repoUrl.trim() || null;
    if (Array.isArray(body?.extraLinks)) {
      patch.extraLinks = (body.extraLinks as unknown[])
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim());
    }

    const [row] = await db.update(titleReports).set(patch).where(eq(titleReports.id, report.id)).returning();
    return NextResponse.json({ report: row });
  } catch (err) {
    if (isSchemaDrift(err)) return jsonError('Version reports are not available yet.', 503);
    throw err;
  }
}
