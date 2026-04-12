import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const website = request.nextUrl.searchParams.get('website');

  if (!website) {
    return NextResponse.json({ error: 'website is required' }, { status: 400 });
  }

  return NextResponse.json(
    { error: 'Email enrichment is temporarily disabled.' },
    { status: 503 },
  );
}
