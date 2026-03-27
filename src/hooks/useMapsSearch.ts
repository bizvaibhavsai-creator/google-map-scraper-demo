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

const WORKER_URL = process.env.NEXT_PUBLIC_EMAIL_WORKER_URL || 'http://localhost:3001';
const POLL_INTERVAL = 3000;

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

export function useMapsSearch() {
  const [results, setResults] = useState<MapResult[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const abortRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const allResultsRef = useRef<MapResult[]>([]);
  const paramsRef = useRef<SearchParams | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current = true;
    stopPolling();
    setStatus('idle');
  }, [stopPolling]);

  const poll = useCallback(
    async (jobId: string, sinceRef: { current: number }, startTime: number) => {
      if (abortRef.current) {
        stopPolling();
        return;
      }

      try {
        const res = await fetch(`${WORKER_URL}/search/${jobId}?since=${sinceRef.current}`);
        const data = await res.json();

        // Append only new results
        if (data.results.length > 0) {
          allResultsRef.current.push(...data.results);
          sinceRef.current = data.nextSince;

          if (paramsRef.current) {
            setResults(applyFilters(allResultsRef.current, paramsRef.current));
          }
        }

        // Update progress
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = data.completed / elapsed;
        const remaining = data.total - data.completed;
        const eta = rate > 0 ? Math.round(remaining / rate) : null;

        setProgress({
          completed: data.completed,
          total: data.total,
          percent: Math.round((data.completed / data.total) * 100),
          etaSeconds: eta,
        });

        if (data.status === 'complete') {
          stopPolling();
          if (paramsRef.current) {
            setResults(applyFilters(allResultsRef.current, paramsRef.current));
          }
          setStatus('success');
        }
      } catch {
        // retry on next interval
      }
    },
    [stopPolling],
  );

  const search = useCallback(
    async (params: SearchParams) => {
      abortRef.current = false;
      stopPolling();
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

      setProgress({ completed: 0, total: pairs.length, percent: 0, etaSeconds: null });

      try {
        const res = await fetch(`${WORKER_URL}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pairs,
            params: {
              country: params.country,
              language: params.language,
              limit: params.limit,
            },
          }),
        });

        if (!res.ok) throw new Error('Failed to start search job');

        const { jobId } = await res.json();
        const sinceRef = { current: 0 };
        const startTime = Date.now();

        // Poll for results every 3s
        pollRef.current = setInterval(
          () => poll(jobId, sinceRef, startTime),
          POLL_INTERVAL,
        );
        poll(jobId, sinceRef, startTime); // immediate first poll
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to search worker');
        setStatus('error');
      }
    },
    [poll, stopPolling],
  );

  return { results, status, error, progress, search, cancel };
}
