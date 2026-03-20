import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const website = searchParams.get('website');

  if (!website) {
    return NextResponse.json({ error: 'website is required' }, { status: 400 });
  }

  const url = new URL('https://website-contacts-scraper.scraper.tech/scrape-contacts-from-website');
  url.searchParams.set('query', website);
  url.searchParams.set('match_email_domain', 'true');
  url.searchParams.set('external_matching', 'true');

  const upstream = await fetch(url.toString(), {
    headers: { 'Scraper-Key': process.env.SCRAPER_API_KEY! },
    cache: 'no-store',
  });

  const data = await upstream.json();

  // Response shape: { status, data: [{ emails: string[], phone_numbers: [{value, sources}][] }] }
  const record = Array.isArray(data.data) ? data.data[0] : null;

  const emails: string[] = (record?.emails ?? []).map((e: { value: string }) => e.value);

  return NextResponse.json({ emails }, { status: upstream.ok ? 200 : upstream.status });
}
