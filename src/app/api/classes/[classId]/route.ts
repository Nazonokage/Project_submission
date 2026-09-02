import { NextResponse } from 'next/server';
import { getProfSession } from '@/lib/auth';
import { assertClassOwnedByProf, jsonError } from '@/lib/helpers';

export async function GET(_req: Request, { params }: { params: { classId: string } }) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const cls = await assertClassOwnedByProf(params.classId, prof.profId);
  if (!cls) return jsonError('Class not found', 404);

  return NextResponse.json({ class: cls });
}
