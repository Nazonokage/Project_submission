import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { titles } from '@/lib/schema';

export async function findSimilarTitles(classId: string, slotId: string, text: string, excludeId?: string) {
  // Literal substring matching: user-entered % and _ are not wildcards.
  return db.select({ id: titles.id, text: titles.text, status: titles.status }).from(titles).where(and(
    eq(titles.classId, classId), eq(titles.slotId, slotId), isNull(titles.deletedAt),
    excludeId ? ne(titles.id, excludeId) : undefined,
    sql`(similarity(${titles.text}, ${text}) >= 0.4 OR strpos(lower(${titles.text}), lower(${text})) > 0)`
  )).limit(10);
}
export async function duplicateGuard(classId: string, slotId: string, text: string, mode: string, confirmed: unknown, excludeId?: string) {
  const duplicates = await findSimilarTitles(classId, slotId, text, excludeId);
  if (duplicates.length && (mode === 'strict' || confirmed !== true)) {
    return NextResponse.json({ error: mode === 'strict' ? 'A similar title already exists in this slot' : 'Similar titles exist. Confirm to continue.', duplicates, requiresConfirmation: mode !== 'strict' }, { status: 409 });
  }
  return null;
}
