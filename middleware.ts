import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-do-not-use');

const PROF_COOKIE = 'prof_token';
const STUDENT_COOKIE = 'student_token';

async function isValid(token: string | undefined) {
  if (!token) return false;
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect prof dashboard
  if (pathname.startsWith('/dashboard')) {
    const token = req.cookies.get(PROF_COOKIE)?.value;
    if (!(await isValid(token))) {
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
    if (!(await isValid(token))) {
      const url = req.nextUrl.clone();
      url.pathname = `/c/${studentMatch[1]}/login`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/c/:path*'],
};
