import { NextRequest, NextResponse } from 'next/server';

// Recursively walk any JSON value and collect strings that look like emails
function extractEmails(obj: unknown): string[] {
  const found = new Set<string>();
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

  function walk(val: unknown) {
    if (typeof val === 'string') {
      const matches = val.match(emailRegex);
      if (matches) matches.forEach((m) => found.add(m.toLowerCase()));
    } else if (Array.isArray(val)) {
      val.forEach(walk);
    } else if (val && typeof val === 'object') {
      Object.values(val).forEach(walk);
    }
  }

  walk(obj);
  return Array.from(found);
}

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

  const text = await upstream.text();
  if (!text) {
    return NextResponse.json({ emails: [] }, { status: 200 });
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // If response isn't JSON, scan raw text for emails
    const emails = extractEmails(text);
    return NextResponse.json({ emails }, { status: 200 });
  }

  // Scan the entire response payload for any string containing @
  const emails = extractEmails(data);

  return NextResponse.json({ emails }, { status: upstream.ok ? 200 : upstream.status });
}
