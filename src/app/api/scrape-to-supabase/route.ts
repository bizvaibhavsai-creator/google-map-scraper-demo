import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

interface MapResult {
  business_id: string;
  name: string;
  full_address: string;
  phone_number: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  types: string | string[] | null;
  is_permanently_closed: boolean | null;
  is_temporarily_closed: boolean | null;
  place_id: string | null;
}

async function fetchMaps(keyword: string, location: string, country: string, lang: string, limit: string): Promise<MapResult[]> {
  const query = `${keyword} in ${location}`;
  const url = new URL('https://api.scraper.tech/searchmaps.php');
  url.searchParams.set('query', query);
  url.searchParams.set('limit', limit);
  url.searchParams.set('country', country);
  url.searchParams.set('lang', lang);

  const res = await fetch(url.toString(), {
    headers: { 'Scraper-Key': process.env.SCRAPER_API_KEY!, 'Accept': 'application/json' },
    cache: 'no-store',
  });

  const text = await res.text();
  if (!text) return [];

  try {
    const data = JSON.parse(text);
    const raw = Array.isArray(data) ? data : (data.data ?? data.results ?? []);
    return raw as MapResult[];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { keywords, locations, country, language, limit, minReviews, filterPermanentlyClosed, filterTemporarilyClosed, category } = body;

  if (!keywords?.length || !locations?.length) {
    return NextResponse.json({ error: 'keywords and locations are required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const limitStr = String(limit || 20);
  const countryStr = country || 'us';
  const langStr = language || 'en';

  // Build all keyword-location pairs
  const pairs: [string, string][] = [];
  for (const kw of keywords) {
    for (const loc of locations) {
      pairs.push([kw, loc]);
    }
  }

  let totalInserted = 0;
  const totalPairs = pairs.length;
  let completed = 0;

  // Process in batches of 10 concurrent requests
  const CONCURRENCY = 10;
  let index = 0;

  async function worker() {
    while (index < pairs.length) {
      const i = index++;
      const [kw, loc] = pairs[i];

      try {
        let results = await fetchMaps(kw, loc, countryStr, langStr, limitStr);

        // Apply filters
        if (minReviews > 0) {
          results = results.filter((r) => (r.review_count ?? 0) >= minReviews);
        }
        if (filterPermanentlyClosed && filterPermanentlyClosed !== 'any') {
          const want = filterPermanentlyClosed === 'true';
          results = results.filter((r) => Boolean(r.is_permanently_closed) === want);
        }
        if (filterTemporarilyClosed && filterTemporarilyClosed !== 'any') {
          const want = filterTemporarilyClosed === 'true';
          results = results.filter((r) => Boolean(r.is_temporarily_closed) === want);
        }
        if (category) {
          const cat = category.toLowerCase();
          results = results.filter((r) => {
            const types = Array.isArray(r.types) ? r.types : r.types ? [r.types] : [];
            return types.some((t) => t.toLowerCase().includes(cat));
          });
        }

        if (results.length > 0) {
          const rows = results.map((r) => ({
            business_id: r.business_id,
            name: r.name,
            types: Array.isArray(r.types) ? r.types.join(', ') : (r.types || null),
            is_permanently_closed: Boolean(r.is_permanently_closed),
            is_temporarily_closed: Boolean(r.is_temporarily_closed),
            keyword: kw,
            location: loc,
            full_address: r.full_address || null,
            phone_number: r.phone_number || null,
            rating: r.rating ?? null,
            review_count: r.review_count ?? null,
            website: r.website || null,
            place_id: r.place_id || null,
            emails: [],
            enrichment_status: r.website ? 'pending' : 'skipped',
          }));

          const { error } = await supabase
            .from('businesses')
            .upsert(rows, { onConflict: 'business_id', ignoreDuplicates: false });

          if (!error) {
            totalInserted += rows.length;
          }
        }
      } catch {
        // skip failed pair
      }

      completed++;
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, totalPairs) }, () => worker());
  await Promise.all(workers);

  return NextResponse.json({ inserted: totalInserted, pairs: totalPairs, completed });
}
