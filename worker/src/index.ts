interface Env {
  SCRAPER_API_KEY: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function clampLimit(rawLimit: string | null | undefined): string {
  const parsed = Number(rawLimit ?? 20);
  const safe = Number.isFinite(parsed) ? parsed : 20;
  return String(Math.max(1, Math.trunc(safe)));
}

// --------------- Concurrency limiter ---------------
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
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

// --------------- Strip result to keep payload small ---------------
function stripResult(r: Record<string, unknown>) {
  return {
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
  };
}

// --------------- Fetch one search pair ---------------
async function fetchSearchPair(
  keyword: string,
  location: string,
  limit: string,
  country: string,
  lang: string,
  env: Env,
): Promise<Record<string, unknown>[]> {
  const query = `${keyword} in ${location}`;
  const apiUrl = new URL('https://api.scraper.tech/searchmaps.php');
  apiUrl.searchParams.set('query', query);
  apiUrl.searchParams.set('limit', limit);
  apiUrl.searchParams.set('country', country);
  apiUrl.searchParams.set('lang', lang);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(apiUrl.toString(), {
      headers: { 'Scraper-Key': env.SCRAPER_API_KEY, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    if (!text) return [];

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return [];
    }

    const raw = Array.isArray(data)
      ? data
      : (((data as Record<string, unknown>).data ??
          (data as Record<string, unknown>).results ??
          []) as unknown[]);

    return (raw as Record<string, unknown>[]).map(stripResult);
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

// --------------- Fetch emails for one website ---------------
async function fetchEmailsForWebsite(
  website: string,
  env: Env,
): Promise<string[]> {
  const apiUrl = new URL(
    'https://website-contacts-scraper.scraper.tech/scrape-contacts-from-website',
  );
  apiUrl.searchParams.set('query', website);
  apiUrl.searchParams.set('match_email_domain', 'true');
  apiUrl.searchParams.set('external_matching', 'true');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(apiUrl.toString(), {
      headers: { 'Scraper-Key': env.SCRAPER_API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    if (!text) return [];

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return extractEmails(text);
    }

    return extractEmails(data);
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

// --------------- /api/search — one keyword+location pair ---------------
async function handleSearch(url: URL, env: Env): Promise<Response> {
  const keyword = url.searchParams.get('keyword');
  const location = url.searchParams.get('location');
  const limit = clampLimit(url.searchParams.get('limit'));
  const country = url.searchParams.get('country') || 'us';
  const lang = url.searchParams.get('lang') || 'en';

  if (!keyword || !location) {
    return json({ error: 'keyword and location are required' }, 400);
  }

  const results = await fetchSearchPair(keyword, location, limit, country, lang, env);
  return json(results);
}

// --------------- /api/search/batch — multiple pairs at once ---------------
// POST body: { pairs: [{keyword, location}], limit, country, lang }
// Server-side concurrency = 10 (avoids browser connection limits)
const BATCH_SEARCH_CONCURRENCY = 10;

async function handleSearchBatch(request: Request, env: Env): Promise<Response> {
  let body: {
    pairs: { keyword: string; location: string }[];
    limit?: string;
    country?: string;
    lang?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const pairs = body.pairs;
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return json({ error: 'pairs array is required' }, 400);
  }

  const limit = clampLimit(body.limit);
  const country = body.country || 'us';
  const lang = body.lang || 'en';

  const tasks = pairs.map(
    (p) => () => fetchSearchPair(p.keyword, p.location, limit, country, lang, env),
  );

  const allResults = await runWithConcurrency(tasks, BATCH_SEARCH_CONCURRENCY);

  // Return results keyed by index, with keyword/location for client-side tracking
  const response = pairs.map((p, i) => ({
    keyword: p.keyword,
    location: p.location,
    results: allResults[i],
  }));

  return json(response);
}

// --------------- /api/enrich — one website ---------------
async function handleEnrich(url: URL, env: Env): Promise<Response> {
  const website = url.searchParams.get('website');
  if (!website) {
    return json({ error: 'website is required' }, 400);
  }

  const emails = await fetchEmailsForWebsite(website, env);
  return json({ emails });
}

// --------------- /api/enrich/batch — multiple websites at once ---------------
// POST body: { items: [{businessId, website}] }
// Server-side concurrency = 8
const BATCH_ENRICH_CONCURRENCY = 8;

async function handleEnrichBatch(request: Request, env: Env): Promise<Response> {
  let body: {
    items: { businessId: string; website: string }[];
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return json({ error: 'items array is required' }, 400);
  }

  // Cap batch size to 30
  const capped = items.slice(0, 30);

  const tasks = capped.map(
    (item) => () => fetchEmailsForWebsite(item.website, env),
  );

  const allEmails = await runWithConcurrency(tasks, BATCH_ENRICH_CONCURRENCY);

  const response = capped.map((item, i) => ({
    businessId: item.businessId,
    emails: allEmails[i],
  }));

  return json(response);
}

// --------------- Main handler ---------------
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Single endpoints (backwards compatible)
    if (url.pathname === '/api/search' && request.method === 'GET') return handleSearch(url, env);
    if (url.pathname === '/api/enrich' && request.method === 'GET') return handleEnrich(url, env);

    // Batch endpoints (POST)
    if (url.pathname === '/api/search/batch' && request.method === 'POST') return handleSearchBatch(request, env);
    if (url.pathname === '/api/enrich/batch' && request.method === 'POST') return handleEnrichBatch(request, env);

    if (url.pathname === '/health') return json({ ok: true });

    return json({ error: 'not found' }, 404);
  },
};
