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

const CONCURRENCY = 15;

async function fetchForKeywordAndLocation(
  params: SearchParams,
  keyword: string,
  location: string
): Promise<MapResult[]> {
  const qs = new URLSearchParams({
    keyword,
    location,
    country: params.country,
    language: params.language,
    limit: String(params.limit),
  });

  const res = await fetch(`/api/maps-search?${qs}`);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);

  const raw: MapResult[] = Array.isArray(data) ? data : (data.data ?? data.results ?? []);
  return raw.map((r) => ({ ...r, _location: location, _keyword: keyword }));
}

export function useMapsSearch() {
  const [results, setResults] = useState<MapResult[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const abortRef = useRef(false);

  const search = useCallback(async (params: SearchParams) => {
    abortRef.current = false;
    setStatus('loading');
    setError(null);
    setResults([]);
    setProgress(null);

    const keywords = params.keyword.split(',').map((k) => k.trim()).filter(Boolean);
    const locations = params.location.split(',').map((l) => l.trim()).filter(Boolean);

    const pairs: [string, string][] = [];
    for (const kw of keywords) {
      for (const loc of locations) {
        pairs.push([kw, loc]);
      }
    }

    const total = pairs.length;
    let completed = 0;
    const startTime = Date.now();
    const allResults: MapResult[] = [];

    setProgress({ completed: 0, total, percent: 0, etaSeconds: null });

    try {
      // Process with a concurrency pool
      let index = 0;

      async function next(): Promise<void> {
        while (index < pairs.length) {
          if (abortRef.current) return;
          const i = index++;
          const [kw, loc] = pairs[i];
          try {
            const batch = await fetchForKeywordAndLocation(params, kw, loc);
            allResults.push(...batch);
          } catch {
            // skip failed individual requests
          }
          completed++;
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = completed / elapsed;
          const remaining = total - completed;
          const eta = rate > 0 ? Math.round(remaining / rate) : null;
          setProgress({
            completed,
            total,
            percent: Math.round((completed / total) * 100),
            etaSeconds: eta,
          });
        }
      }

      // Launch CONCURRENCY workers
      const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, () => next());
      await Promise.all(workers);

      // Apply filters
      let filtered = allResults;

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

      const list = filtered.slice(0, params.limit);

      setResults(list);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, []);

  const cancel = useCallback(() => { abortRef.current = true; setStatus('idle'); }, []);

  return { results, status, error, progress, search, cancel };
}
