interface Env {
  SCRAPER_API_KEY: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// --------------- Email extraction ---------------
function extractEmails(obj: unknown): string[] {
  const found = new Set<string>();
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

  function walk(val: unknown) {
    if (typeof val === 'string') {
      const m = val.match(re);
      if (m) m.forEach((e) => found.add(e.toLowerCase()));
    } else if (Array.isArray(val)) {
      val.forEach(walk);
    } else if (val && typeof val === 'object') {
      Object.values(val).forEach(walk);
    }
  }

  walk(obj);
  return Array.from(found);
}

// --------------- /api/search — one keyword+location pair ---------------
async function handleSearch(url: URL, env: Env): Promise<Response> {
  const keyword = url.searchParams.get('keyword');
  const location = url.searchParams.get('location');
  const limit = url.searchParams.get('limit') || '20';
  const country = url.searchParams.get('country') || 'us';
  const lang = url.searchParams.get('lang') || 'en';

  if (!keyword || !location) {
    return json({ error: 'keyword and location are required' }, 400);
  }

  const query = `${keyword} in ${location}`;
  const apiUrl = new URL('https://api.scraper.tech/searchmaps.php');
  apiUrl.searchParams.set('query', query);
  apiUrl.searchParams.set('limit', limit);
  apiUrl.searchParams.set('country', country);
  apiUrl.searchParams.set('lang', lang);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const res = await fetch(apiUrl.toString(), {
      headers: { 'Scraper-Key': env.SCRAPER_API_KEY, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    if (!text) return json([]);

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return json([]);
    }

    const raw = Array.isArray(data)
      ? data
      : ((data as Record<string, unknown>).data ?? (data as Record<string, unknown>).results ?? []) as unknown[];

    // Strip bulky fields to keep response small
    const results = (raw as Record<string, unknown>[]).map((r) => ({
      business_id: r.business_id,
      name: r.name,
      full_address: r.full_address,
      phone_number: r.phone_number,
      website: r.website,
      rating: r.rating,
      review_count: r.review_count,
      types: r.types,
      is_permanently_closed: r.is_permanently_closed,
      is_temporarily_closed: r.is_temporarily_closed,
      latitude: r.latitude,
      longitude: r.longitude,
      place_id: r.place_id,
    }));

    return json(results);
  } catch {
    clearTimeout(timeout);
    return json([]);
  }
}

// --------------- /api/enrich — one website ---------------
async function handleEnrich(url: URL, env: Env): Promise<Response> {
  const website = url.searchParams.get('website');
  if (!website) {
    return json({ error: 'website is required' }, 400);
  }

  const apiUrl = new URL(
    'https://website-contacts-scraper.scraper.tech/scrape-contacts-from-website',
  );
  apiUrl.searchParams.set('query', website);
  apiUrl.searchParams.set('match_email_domain', 'true');
  apiUrl.searchParams.set('external_matching', 'true');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(apiUrl.toString(), {
      headers: { 'Scraper-Key': env.SCRAPER_API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    if (!text) return json({ emails: [] });

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return json({ emails: extractEmails(text) });
    }

    return json({ emails: extractEmails(data) });
  } catch {
    clearTimeout(timeout);
    return json({ emails: [] });
  }
}

// --------------- Main handler ---------------
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/search') return handleSearch(url, env);
    if (url.pathname === '/api/enrich') return handleEnrich(url, env);
    if (url.pathname === '/health') return json({ ok: true });

    return json({ error: 'not found' }, 404);
  },
};
