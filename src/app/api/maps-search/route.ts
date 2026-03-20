import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const keyword = searchParams.get('keyword');
  const location = searchParams.get('location');
  const country = searchParams.get('country') ?? 'us';
  const lang = searchParams.get('language') ?? 'en';
  const limit = searchParams.get('limit') ?? '20';

  if (!keyword || !location) {
    return NextResponse.json({ error: 'keyword and location are required' }, { status: 400 });
  }

  const query = `${keyword} in ${location}`;

  const url = new URL('https://api.scraper.tech/searchmaps.php');
  url.searchParams.set('query', query);
  url.searchParams.set('limit', limit);
  url.searchParams.set('country', country);
  url.searchParams.set('lang', lang);

  const upstream = await fetch(url.toString(), {
    headers: {
      'Scraper-Key': process.env.SCRAPER_API_KEY!,
      'Accept': 'application/json',
    },
    cache: 'no-store',
  });

  const text = await upstream.text();
  const headers: Record<string, string> = {};
  upstream.headers.forEach((v, k) => { headers[k] = v; });
  console.log('[maps-search] status:', upstream.status, 'headers:', JSON.stringify(headers), 'body:', text.slice(0, 500));

  if (!text) {
    return NextResponse.json(
      { error: `Empty response from scraper.tech (HTTP ${upstream.status})` },
      { status: 502 }
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: `Non-JSON response: ${text.slice(0, 200)}` }, { status: 502 });
  }

  return NextResponse.json(data, { status: upstream.ok ? 200 : upstream.status });
}
