import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { titleReports } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, jsonError } from '@/lib/helpers';
import { isSchemaDrift } from '@/lib/pg-errors';

export async function PATCH(req: NextRequest, { params }: { params: { reportId: string } }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const body = await req.json().catch(() => null);
  if (typeof body?.isEditable !== 'boolean') return jsonError('isEditable is required', 422);

  try {
    const [report] = await db.select().from(titleReports).where(eq(titleReports.id, params.reportId)).limit(1);
    if (!report) return jsonError('Report not found', 404);
    const cls = await assertClassOwnedByProf(report.classId, prof.profId);
    if (!cls) return jsonError('Not authorized', 403);

    const [row] = await db
      .update(titleReports)
      .set({ isEditable: body.isEditable, updatedAt: new Date() })
      .where(eq(titleReports.id, report.id))
      .returning();
    return NextResponse.json({ report: row });
  } catch (err) {
    if (isSchemaDrift(err)) return jsonError('Version reports are not available yet.', 503);
    throw err;
  }
}
