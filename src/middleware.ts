import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

const PROF_COOKIE = 'prof_token';
const STUDENT_COOKIE = 'student_token';

async function isValid(token: string | undefined, audience: string, classId?: string) {
  if (!token || !process.env.JWT_SECRET) return false;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'], audience });
    if (audience === 'professor-session' && (typeof payload.profId !== 'string' || typeof payload.email !== 'string')) return false;
    if (audience === 'student-session' && (typeof payload.studentId !== 'string' || typeof payload.credentialVersion !== 'string' || payload.classId !== classId)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/')) {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.get('origin');
      const expectedOrigin = process.env.APP_ORIGIN || req.nextUrl.origin;
      if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== expectedOrigin)) {
        return NextResponse.json({ error: 'Cross-site requests are not allowed' }, { status: 403 });
      }
      if (Number(req.headers.get('content-length')) > 262144) return NextResponse.json({ error: 'Request is too large' }, { status: 413 });
    }
    return NextResponse.next();
  }

  // Protect prof dashboard
  if (pathname.startsWith('/dashboard')) {
    const token = req.cookies.get(PROF_COOKIE)?.value;
    if (!(await isValid(token, 'professor-session'))) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }

  // Protect student class routes, except the login page itself
  const studentMatch = pathname.match(/^\/c\/([^/]+)(\/.*)?$/);
  if (studentMatch && !pathname.endsWith('/login')) {
    const token = req.cookies.get(STUDENT_COOKIE)?.value;
    if (!(await isValid(token, 'student-session', studentMatch[1]))) {
      const url = req.nextUrl.clone();
      url.pathname = `/c/${studentMatch[1]}/login`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/c/:path*', '/api/:path*'],
};
