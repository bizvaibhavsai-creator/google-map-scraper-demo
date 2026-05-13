const BATCH_SEARCH_CONCURRENCY = 10;

function getScraperApiKey(): string {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) {
    throw new Error('SCRAPER_API_KEY is not configured');
  }
  return apiKey;
}

export function clampLimit(rawLimit: string | null | undefined): string {
  const parsed = Number(rawLimit ?? 20);
  const safe = Number.isFinite(parsed) ? parsed : 20;
  return String(Math.max(1, Math.trunc(safe)));
}

export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

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

export async function fetchSearchPair(
  keyword: string,
  location: string,
  limit: string,
  country: string,
  lang: string,
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
      headers: { 'Scraper-Key': getScraperApiKey(), Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
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

export async function fetchSearchBatch(
  pairs: Array<{ keyword: string; location: string }>,
  limit: string,
  country: string,
  lang: string,
) {
  const tasks = pairs.map(
    (pair) => () => fetchSearchPair(pair.keyword, pair.location, limit, country, lang),
  );
  const allResults = await runWithConcurrency(tasks, BATCH_SEARCH_CONCURRENCY);

  return pairs.map((pair, index) => ({
    keyword: pair.keyword,
    location: pair.location,
    results: allResults[index],
  }));
}
