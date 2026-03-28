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

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
const CONCURRENCY = 10;

function applyFilters(raw: MapResult[], params: SearchParams): MapResult[] {
  let filtered = raw;

  if (params.minReviews > 0) {
    filtered = filtered.filter((r) => (r.review_count ?? 0) >= params.minReviews);
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

async function fetchPair(
  keyword: string,
  location: string,
  params: { country: string; language: string; limit: number },
): Promise<MapResult[]> {
  const url = new URL(`${WORKER_URL}/api/search`);
  url.searchParams.set('keyword', keyword);
  url.searchParams.set('location', location);
  url.searchParams.set('limit', String(params.limit));
  url.searchParams.set('country', params.country);
  url.searchParams.set('lang', params.language);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function useMapsSearch() {
  const [results, setResults] = useState<MapResult[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const abortRef = useRef(false);
  const allResultsRef = useRef<MapResult[]>([]);
  const paramsRef = useRef<SearchParams | null>(null);

  const cancel = useCallback(() => {
    abortRef.current = true;
    setStatus('idle');
  }, []);

  const search = useCallback(async (params: SearchParams) => {
    abortRef.current = false;
    setStatus('loading');
    setError(null);
    setResults([]);
    setProgress(null);
    allResultsRef.current = [];
    paramsRef.current = params;

    const keywords = params.keyword.split(',').map((k) => k.trim()).filter(Boolean);
    const locations = params.location.split(',').map((l) => l.trim()).filter(Boolean);

    const pairs: [string, string][] = [];
    for (const kw of keywords) {
      for (const loc of locations) {
        pairs.push([kw, loc]);
      }
    }

    if (pairs.length === 0) {
      setStatus('success');
      return;
    }

    const total = pairs.length;
    let completed = 0;
    const startTime = Date.now();
    const seen = new Set<string>();
    // Throttle React state updates to avoid excessive re-renders on large scrapes
    let updateTimer: ReturnType<typeof setTimeout> | null = null;
    let dirty = false;

    function scheduleUpdate() {
      dirty = true;
      if (updateTimer) return;
      updateTimer = setTimeout(() => {
        updateTimer = null;
        if (!dirty) return;
        dirty = false;
        if (paramsRef.current) {
          setResults(applyFilters(allResultsRef.current, paramsRef.current));
        }
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = completed / elapsed;
        const remaining = total - completed;
        setProgress({
          completed,
          total,
          percent: Math.round((completed / total) * 100),
          etaSeconds: rate > 0 ? Math.round(remaining / rate) : null,
        });
      }, 500);
    }

    setProgress({ completed: 0, total, percent: 0, etaSeconds: null });

    // Process pairs with concurrency limit
    let index = 0;

    async function worker() {
      while (index < pairs.length) {
        if (abortRef.current) return;
        const i = index++;
        const [keyword, location] = pairs[i];

        const results = await fetchPair(keyword, location, {
          country: params.country,
          language: params.language,
          limit: params.limit,
        });

        // Deduplicate and tag with keyword/location
        for (const r of results) {
          if (r.business_id && !seen.has(r.business_id)) {
            seen.add(r.business_id);
            allResultsRef.current.push({
              ...r,
              _location: location,
              _keyword: keyword,
            });
          }
        }

        completed++;
        scheduleUpdate();
      }
    }

    try {
      // Launch concurrent workers
      const workers = Array.from({ length: Math.min(CONCURRENCY, pairs.length) }, () => worker());
      await Promise.all(workers);
    } catch (err) {
      if (!abortRef.current) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setStatus('error');
        return;
      }
    }

    // Final flush
    if (updateTimer) clearTimeout(updateTimer);

    if (!abortRef.current) {
      if (paramsRef.current) {
        setResults(applyFilters(allResultsRef.current, paramsRef.current));
      }
      setProgress({ completed: total, total, percent: 100, etaSeconds: 0 });
      setStatus('success');
    }
  }, []);

  return { results, status, error, progress, search, cancel };
}
