import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { students } from '@/lib/schema';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, jsonError } from '@/lib/helpers';
import { recoverStudentPassword } from '@/lib/password';
import { csvCell } from '@/lib/csv';

export async function GET(_req: Request, { params }: { params: Promise<{ classId: string }> }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);
  const { classId } = await params;
  const cls = await assertClassOwnedByProf(classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);
  const rows = await db.select().from(students).where(eq(students.classId, classId)).orderBy(asc(students.name));
  const csv = [['Name', 'ID Number', 'Password', 'Password status'].map(csvCell).join(',')];
  for (const row of rows) {
    const password = await recoverStudentPassword(row, cls);
    csv.push([row.name, row.idNumber, password ?? '', password === null ? 'Reset required' : 'Current password'].map(csvCell).join(','));
  }
  return new NextResponse('\uFEFF' + csv.join('\r\n') + '\r\n', { headers: {
    'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="roster.csv"',
    'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff',
  } });
}
