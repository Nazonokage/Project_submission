import { NextResponse } from 'next/server';
import { forgetProf, getRememberedProf } from '@/lib/prof-remember';
import { clearProfCookie } from '@/lib/auth';

export async function GET() {
  const remembered = await getRememberedProf();
  return NextResponse.json({ email: remembered?.email || null }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE() {
  await forgetProf();
  await clearProfCookie();
  return NextResponse.json({ ok: true });
}
