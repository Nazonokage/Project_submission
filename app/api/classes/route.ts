import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { classes } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { getProfSession } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET() {
  const prof = await getProfSession();
  if (!prof) return jsonError('Not authenticated', 401);

  const rows = await db
    .select()
    .from(classes)
    .where(eq(classes.profId, prof.profId))
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
