'use client';

import { useState, useCallback, useRef } from 'react';
import type { MapResult, SearchParams } from '@/types';

type Status = 'idle' | 'loading' | 'success' | 'error';

export interface SearchProgress {
  completed: number;
  total: number;
  percent: number;
  etaSeconds: number | null;
}

// ──────────────────── Tuning knobs ────────────────────
// How many keyword+location pairs to send in each batch POST
const BATCH_SIZE = 50;
// How many batch requests to run in parallel from the browser
// 5 batches × 50 pairs × 10 server-side concurrency = 500 effective parallel API calls
const CONCURRENT_BATCHES = 5;
// How often (ms) we flush accumulated results into React state
// Longer = fewer re-renders = smoother UI at scale
const STATE_FLUSH_INTERVAL = 400;
// ──────────────────────────────────────────────────────

interface BatchSearchResponse {
  keyword: string;
  location: string;
  results: MapResult[];
}

function normalizeWebsite(website: string | null | undefined): string | null {
  if (!website) return null;

  const trimmed = website.trim();
  if (!trimmed) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    return url.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .toLowerCase() || null;
  }
}

function applyFilters(raw: MapResult[], params: SearchParams): MapResult[] {
  let filtered = raw;

  if (params.minReviews > 0) {
    filtered = filtered.filter((r) => (r.review_count ?? 0) >= params.minReviews);
  }
  if (params.maxReviews > 0) {
    filtered = filtered.filter((r) => (r.review_count ?? 0) <= params.maxReviews);
  }
  if (params.filterPermanentlyClosed !== 'any') {
    const want = params.filterPermanentlyClosed === 'true';
    filtered = filtered.filter((r) => Boolean(r.is_permanently_closed) === want);
  }
  if (params.filterTemporarilyClosed !== 'any') {
    const want = params.filterTemporarilyClosed === 'true';
    filtered = filtered.filter((r) => Boolean(r.is_temporarily_closed) === want);
  }
  if (params.category) {
    const cat = params.category.toLowerCase();
    filtered = filtered.filter((r) => {
      const types = Array.isArray(r.types) ? r.types : r.types ? [r.types] : [];
      return types.some((t) => t.toLowerCase().includes(cat));
    });
  }

  return filtered.slice(0, params.limit);
}

// ──────── Legacy single-request fetch (kept for fallback) ────────
async function fetchPairSingle(
  keyword: string,
  location: string,
  params: { country: string; language: string; limit: number },
): Promise<MapResult[]> {
  const query = new URLSearchParams({
    keyword,
    location,
    limit: String(params.limit),
    country: params.country,
    lang: params.language,
  });

  try {
    const res = await fetch(`/api/search?${query.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ──────── Batch fetch — sends up to BATCH_SIZE pairs per POST ────────
async function fetchBatch(
  pairs: { keyword: string; location: string }[],
  params: { country: string; language: string; limit: number },
  signal?: AbortSignal,
): Promise<BatchSearchResponse[]> {
  try {
    const res = await fetch('/api/search/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairs,
        limit: String(params.limit),
        country: params.country,
        lang: params.language,
      }),
      signal,
    });
    if (!res.ok) {
      // Fallback: if batch endpoint doesn't exist, fetch individually
      if (res.status === 404) {
        const results: BatchSearchResponse[] = [];
        for (const p of pairs) {
          const r = await fetchPairSingle(p.keyword, p.location, params);
          results.push({ keyword: p.keyword, location: p.location, results: r });
        }
        return results;
      }
      return pairs.map((p) => ({ keyword: p.keyword, location: p.location, results: [] }));
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return pairs.map((p) => ({ keyword: p.keyword, location: p.location, results: [] }));
  }
}

// ──────── Yield to main thread to prevent freezing ────────
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => resolve(), { timeout: 50 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export function useMapsSearch() {
  const [results, setResults] = useState<MapResult[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const abortRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const allResultsRef = useRef<MapResult[]>([]);
  const paramsRef = useRef<SearchParams | null>(null);

  const cancel = useCallback(() => {
    abortRef.current = true;
    abortControllerRef.current?.abort();
    setStatus('idle');
  }, []);

  const search = useCallback(async (params: SearchParams) => {
    const sanitizedParams: SearchParams = {
      ...params,
      limit: Math.max(1, Number.isFinite(params.limit) ? params.limit : 20),
    };

    abortRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setStatus('loading');
    setError(null);
    setResults([]);
    setProgress(null);
    allResultsRef.current = [];
    paramsRef.current = sanitizedParams;

    const keywords = sanitizedParams.keyword.split(',').map((k) => k.trim()).filter(Boolean);
    const locations = sanitizedParams.location.split(',').map((l) => l.trim()).filter(Boolean);

    // Build all keyword × location pairs
    const pairs: { keyword: string; location: string }[] = [];
    for (const kw of keywords) {
      for (const loc of locations) {
        pairs.push({ keyword: kw, location: loc });
      }
    }

    if (pairs.length === 0) {
      setStatus('success');
      return;
    }

    // ──── Split pairs into batches of BATCH_SIZE ────
    const batches: { keyword: string; location: string }[][] = [];
    for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
      batches.push(pairs.slice(i, i + BATCH_SIZE));
    }

    const totalPairs = pairs.length;
    let completedPairs = 0;
    const startTime = Date.now();
    const seen = new Set<string>();
    const seenWebsites = new Set<string>();

    // Throttled state flush — runs at most once per STATE_FLUSH_INTERVAL
    // First completion always flushes immediately so ETA appears right away
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let dirty = false;
    let firstFlush = true;

    function doFlush() {
      dirty = false;
      if (abortRef.current) return;
      if (paramsRef.current) {
        setResults(applyFilters(allResultsRef.current, paramsRef.current));
      }
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = completedPairs / Math.max(elapsed, 0.1);
      const remaining = totalPairs - completedPairs;
      setProgress({
        completed: completedPairs,
        total: totalPairs,
        percent: Math.round((completedPairs / totalPairs) * 100),
        etaSeconds: rate > 0 ? Math.round(remaining / rate) : null,
      });
    }

    function scheduleFlush() {
      dirty = true;
      // First completion: flush immediately so ETA shows right away
      if (firstFlush) {
        firstFlush = false;
        doFlush();
        return;
      }
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        if (!dirty) return;
        doFlush();
      }, STATE_FLUSH_INTERVAL);
    }

    setProgress({ completed: 0, total: totalPairs, percent: 0, etaSeconds: null });

    // ──── Process batches with CONCURRENT_BATCHES in parallel ────
    let batchIndex = 0;

    async function batchWorker() {
      while (batchIndex < batches.length) {
        if (abortRef.current) return;
        const bi = batchIndex++;
        const batch = batches[bi];

        const batchResults = await fetchBatch(batch, {
          country: sanitizedParams.country,
          language: sanitizedParams.language,
          limit: sanitizedParams.limit,
        }, controller.signal);

        if (abortRef.current) return;

        // Merge results — deduplicate by business_id
        for (const entry of batchResults) {
          for (const r of entry.results) {
            const normalizedWebsite = normalizeWebsite(r.website);
            const isDuplicateBusinessId = Boolean(r.business_id) && seen.has(r.business_id);
            const isDuplicateWebsite = Boolean(
              params.dedupeWebsite && normalizedWebsite && seenWebsites.has(normalizedWebsite),
            );

            if (isDuplicateBusinessId || isDuplicateWebsite) continue;

            if (r.business_id) {
              seen.add(r.business_id);
            }
            if (params.dedupeWebsite && normalizedWebsite) {
              seenWebsites.add(normalizedWebsite);
            }

            allResultsRef.current.push({
              ...r,
              _location: entry.location,
              _keyword: entry.keyword,
            });
          }
        }

        completedPairs += batch.length;
        scheduleFlush();

        // Yield to main thread between batches so UI stays responsive
        await yieldToMain();
      }
    }

    try {
      const workers = Array.from(
        { length: Math.min(CONCURRENT_BATCHES, batches.length) },
        () => batchWorker(),
      );
      await Promise.all(workers);
    } catch (err) {
      if (!abortRef.current) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setStatus('error');
        return;
      }
    }

    // Final flush
    if (flushTimer) clearTimeout(flushTimer);

    if (!abortRef.current) {
      if (paramsRef.current) {
        setResults(applyFilters(allResultsRef.current, paramsRef.current));
      }
      setProgress({ completed: totalPairs, total: totalPairs, percent: 100, etaSeconds: 0 });
      setStatus('success');
    }
  }, []);

  return { results, status, error, progress, search, cancel };
}
