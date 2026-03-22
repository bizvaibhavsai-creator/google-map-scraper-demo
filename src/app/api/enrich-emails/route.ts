import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

const BATCH_SIZE = 5; // process 5 at a time per request

// Extract emails from the contacts API response
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

async function scrapeContactsForWebsite(website: string): Promise<string[]> {
  const url = new URL('https://website-contacts-scraper.scraper.tech/scrape-contacts-from-website');
  url.searchParams.set('query', website);
  url.searchParams.set('match_email_domain', 'true');
  url.searchParams.set('external_matching', 'true');

  const res = await fetch(url.toString(), {
    headers: { 'Scraper-Key': process.env.SCRAPER_API_KEY! },
    cache: 'no-store',
  });

  const text = await res.text();
  if (!text) return [];

  try {
    const data = JSON.parse(text);
    return extractEmails(data);
  } catch {
    return extractEmails(text);
  }
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabase();

  // Optionally accept specific business_ids, otherwise pick pending rows
  const body = await request.json().catch(() => ({}));
  const businessIds: string[] | undefined = body.business_ids;

  let query = supabase
    .from('businesses')
    .select('business_id, website')
    .eq('enrichment_status', 'pending')
    .not('website', 'is', null)
    .limit(BATCH_SIZE);

  if (businessIds?.length) {
    query = supabase
      .from('businesses')
      .select('business_id, website')
      .in('business_id', businessIds)
      .eq('enrichment_status', 'pending')
      .limit(BATCH_SIZE);
  }

  const { data: rows, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ processed: 0, remaining: 0 });
  }

  // Mark as processing
  await supabase
    .from('businesses')
    .update({ enrichment_status: 'processing' })
    .in('business_id', rows.map((r) => r.business_id));

  // Process each row
  let processed = 0;
  for (const row of rows) {
    try {
      const emails = await scrapeContactsForWebsite(row.website!);
      await supabase
        .from('businesses')
        .update({ emails, enrichment_status: 'done' })
        .eq('business_id', row.business_id);
      processed++;
    } catch {
      await supabase
        .from('businesses')
        .update({ enrichment_status: 'error' })
        .eq('business_id', row.business_id);
    }
  }

  // Count remaining pending
  const { count } = await supabase
    .from('businesses')
    .select('*', { count: 'exact', head: true })
    .eq('enrichment_status', 'pending');

  return NextResponse.json({ processed, remaining: count ?? 0 });
}
