import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { classes } from '@/lib/schema';
import { and, eq, desc, isNull } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET(req: NextRequest) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const includeArchived = req.nextUrl.searchParams.get('includeArchived') === '1';

  const rows = await db
    .select()
    .from(classes)
    .where(
      includeArchived
        ? eq(classes.profId, prof.profId)
        : and(eq(classes.profId, prof.profId), isNull(classes.archivedAt))
    )
    .orderBy(desc(classes.createdAt));

  return NextResponse.json({ classes: rows });
}

export async function POST(req: NextRequest) {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  const term = (body?.term as string | undefined)?.trim();

  if (!name || !term) return jsonError('name and term are required', 422);

  const [row] = await db.insert(classes).values({ name, term, profId: prof.profId }).returning();
  return NextResponse.json({ class: row }, { status: 201 });
}
