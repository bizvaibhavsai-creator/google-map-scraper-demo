'use client';

import { useState, useCallback } from 'react';
import type { MapResult, SearchParams } from '@/types';

type Status = 'idle' | 'loading' | 'success' | 'error';

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

  const search = useCallback(async (params: SearchParams) => {
    setStatus('loading');
    setError(null);
    setResults([]);

    const keywords = params.keyword.split(',').map((k) => k.trim()).filter(Boolean);
    const locations = params.location.split(',').map((l) => l.trim()).filter(Boolean);

    const pairs: [string, string][] = [];
    for (const kw of keywords) {
      for (const loc of locations) {
        pairs.push([kw, loc]);
      }
    }

    try {
      const perPair = await Promise.all(
        pairs.map(([kw, loc]) => fetchForKeywordAndLocation(params, kw, loc))
      );

      const combined = perPair.flat();
      const filtered =
        params.minReviews > 0
          ? combined.filter((r) => (r.review_count ?? 0) >= params.minReviews)
          : combined;
      const list = filtered.slice(0, params.limit);

      setResults(list);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, []);

  return { results, status, error, search };
}
