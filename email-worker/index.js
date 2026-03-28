import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const EMAIL_CONCURRENCY = 5;
const SEARCH_CONCURRENCY = 10;
const MAX_RETRIES = 2;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

// --------------- In-memory job stores ---------------
const emailJobs = new Map();
const searchJobs = new Map();

// Auto-cleanup: completed jobs after 10 min, incomplete after 30 min
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of emailJobs) {
    const maxAge = job.status === 'complete' ? 600_000 : 1_800_000;
    if (now - job.createdAt > maxAge) emailJobs.delete(id);
  }
  for (const [id, job] of searchJobs) {
    const maxAge = job.status === 'complete' ? 600_000 : 1_800_000;
    if (now - job.createdAt > maxAge) searchJobs.delete(id);
  }
}, 30_000);

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// --------------- Email extraction ---------------
function extractEmails(obj) {
  const found = new Set();
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

  function walk(val) {
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

// --------------- Scrape a single website ---------------
async function scrapeOne(website) {
  const url = new URL(
    'https://website-contacts-scraper.scraper.tech/scrape-contacts-from-website',
  );
  url.searchParams.set('query', website);
  url.searchParams.set('match_email_domain', 'true');
  url.searchParams.set('external_matching', 'true');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000); // 15s — no Vercel limit

  try {
    const res = await fetch(url.toString(), {
      headers: { 'Scraper-Key': SCRAPER_API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    if (!text) return [];

    try {
      return extractEmails(JSON.parse(text));
    } catch {
      return extractEmails(text);
    }
  } catch {
    clearTimeout(timeout);
    return null; // signals a retry
  }
}

// --------------- Process an email enrichment job ---------------
async function processEmailJob(job) {
  const { items } = job;
  let running = 0;
  let index = 0;

  return new Promise((resolve) => {
    function next() {
      while (running < EMAIL_CONCURRENCY && index < items.length) {
        const item = items[index++];
        running++;

        (async () => {
          let emails = null;
          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            emails = await scrapeOne(item.website);
            if (emails !== null && emails.length > 0) break;
            if (attempt < MAX_RETRIES) continue;
          }

          job.results[item.businessId] = { emails: emails || [] };
          job.completed++;
          running--;

          if (job.completed === job.total) {
            job.status = 'complete';
            delete job.items;
            resolve();
          } else {
            next();
          }
        })();
      }
    }

    next();
  });
}

// --------------- Routes ---------------

// --------------- Maps search: fetch one keyword+location ---------------
async function fetchMapsSearch(keyword, location, params) {
  const query = `${keyword} in ${location}`;
  const url = new URL('https://api.scraper.tech/searchmaps.php');
  url.searchParams.set('query', query);
  url.searchParams.set('limit', String(params.limit));
  url.searchParams.set('country', params.country);
  url.searchParams.set('lang', params.language);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(url.toString(), {
      headers: { 'Scraper-Key': SCRAPER_API_KEY, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    if (!text) return [];

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return [];
    }

    const raw = Array.isArray(data) ? data : (data.data ?? data.results ?? []);
    // Strip bulky fields (photos, working_hours, etc.) to avoid browser OOM on large scrapes
    return raw.map((r) => ({
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
      _location: location,
      _keyword: keyword,
    }));
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

// --------------- Process a maps search job ---------------
async function processSearchJob(job) {
  const { pairs, params } = job;
  const seen = new Set(); // deduplicate by business_id
  let running = 0;
  let index = 0;

  return new Promise((resolve) => {
    function next() {
      while (running < SEARCH_CONCURRENCY && index < pairs.length) {
        const [keyword, location] = pairs[index++];
        running++;

        (async () => {
          try {
            const results = await fetchMapsSearch(keyword, location, params);
            for (const r of results) {
              if (r.business_id && !seen.has(r.business_id)) {
                seen.add(r.business_id);
                job.results.push(r);
              }
            }
          } catch {
            // skip failed pair
          }
          job.completed++;
          running--;

          if (job.completed === job.total) {
            job.status = 'complete';
            delete job.pairs;
            delete job.params;
            resolve();
          } else {
            next();
          }
        })();
      }
    }
    next();
  });
}

// --------------- Email enrichment routes ---------------

app.post('/enrich', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }

  const jobId = generateId();
  const job = {
    id: jobId,
    status: 'processing',
    total: items.length,
    completed: 0,
    results: {},
    items,
    createdAt: Date.now(),
  };

  emailJobs.set(jobId, job);
  processEmailJob(job);

  res.json({ jobId, total: items.length });
});

app.get('/enrich/:jobId', (req, res) => {
  const job = emailJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'job not found' });

  res.json({
    status: job.status,
    total: job.total,
    completed: job.completed,
    results: job.results,
  });
});

// --------------- Maps search routes ---------------

app.post('/search', (req, res) => {
  const { pairs, params } = req.body;
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return res.status(400).json({ error: 'pairs array required' });
  }

  const jobId = generateId();
  const job = {
    id: jobId,
    status: 'processing',
    total: pairs.length,
    completed: 0,
    results: [],   // array of MapResult (deduplicated)
    pairs,
    params,
    createdAt: Date.now(),
  };

  searchJobs.set(jobId, job);
  processSearchJob(job);

  res.json({ jobId, total: pairs.length });
});

app.get('/search/:jobId', (req, res) => {
  const job = searchJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'job not found' });

  // Only return results the client hasn't seen yet
  const since = parseInt(req.query.since) || 0;
  const newResults = job.results.slice(since);

  res.json({
    status: job.status,
    total: job.total,
    completed: job.completed,
    results: newResults,
    nextSince: job.results.length,
  });
});

// --------------- Health ---------------

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// --------------- Start ---------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Email worker listening on port ${PORT}`);
});
