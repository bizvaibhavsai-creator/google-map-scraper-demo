import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, computeSessionToken } from '@/lib/auth';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/')
  ) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const expected = await computeSessionToken();

  if (!cookie || !expected || cookie !== expected) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
