import { NextResponse } from 'next/server';
import { clearStudentCookie } from '@/lib/auth';

export async function POST() {
  await clearStudentCookie();
  return NextResponse.json({ ok: true });
}
