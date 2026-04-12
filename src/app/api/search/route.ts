import { NextRequest, NextResponse } from 'next/server';
import { clampLimit, fetchSearchPair } from '@/lib/scraper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get('keyword');
  const location = request.nextUrl.searchParams.get('location');
  const limit = clampLimit(request.nextUrl.searchParams.get('limit'));
  const country = request.nextUrl.searchParams.get('country') || 'us';
  const lang = request.nextUrl.searchParams.get('lang') || 'en';

  if (!keyword || !location) {
    return NextResponse.json({ error: 'keyword and location are required' }, { status: 400 });
  }

  try {
    const results = await fetchSearchPair(keyword, location, limit, country, lang);
    return NextResponse.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
