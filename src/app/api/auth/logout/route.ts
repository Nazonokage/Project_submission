import { NextResponse } from 'next/server';
import { clearProfCookie } from '@/lib/auth';

export async function POST() {
  await clearProfCookie();
  return NextResponse.json({ ok: true });
}
