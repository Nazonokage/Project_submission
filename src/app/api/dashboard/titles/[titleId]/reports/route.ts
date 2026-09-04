import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { titleReports, titles } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, jsonError } from '@/lib/helpers';
import { isSchemaDrift } from '@/lib/pg-errors';
import { selectTitleBy } from '@/lib/titles-query';

export async function GET(_req: NextRequest, { params }: { params: { titleId: string } }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const title = await selectTitleBy(eq(titles.id, params.titleId));
  if (!title) return jsonError('Title not found', 404);
  const cls = await assertClassOwnedByProf(title.classId, prof.profId);
  if (!cls) return jsonError('Not authorized', 403);

  try {
    const reports = await db
      .select()
      .from(titleReports)
      .where(eq(titleReports.titleId, title.id))
      .orderBy(desc(titleReports.createdAt));
    return NextResponse.json({ reports });
  } catch (err) {
    if (isSchemaDrift(err)) return NextResponse.json({ reports: [], schemaMissing: true });
    throw err;
  }
}
