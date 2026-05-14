import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE, computeSessionToken } from '@/lib/auth';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const expectedEmail = process.env.AUTH_EMAIL;
  const expectedPassword = process.env.AUTH_PASSWORD;

  if (!expectedEmail || !expectedPassword) {
    return NextResponse.json({ error: 'Authentication is not configured' }, { status: 500 });
  }

  if (body.email !== expectedEmail || body.password !== expectedPassword) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const token = await computeSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
  return response;
}
