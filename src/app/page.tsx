'use client';

import { useState, useCallback } from 'react';
import { SearchForm } from '@/components/SearchForm';
import { ResultsTable } from '@/components/ResultsTable';
import { useMapsSearch } from '@/hooks/useMapsSearch';
import type { SortConfig, SortKey } from '@/types';

export default function HomePage() {
  const { results, status, error, progress, search, cancel } = useMapsSearch();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', dir: 'asc' });

  const handleSort = useCallback((key: SortKey) => {
    setSortConfig((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="mb-6" style={{ animation: 'panelRise 0.4s ease-out both' }}>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-4xl">
          Google Maps Scraper
        </h1>
      </div>

      <div className="space-y-6">
        <SearchForm onSearch={search} isLoading={status === 'loading'} />

        {status === 'loading' && (
          <div className="panel rounded-2xl p-5 sm:p-6" style={{ animation: 'panelRise 0.45s ease-out both' }}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Search Progress</p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">
                    Scraping Google Maps {progress ? `${progress.completed} / ${progress.total} pairs` : 'preparing'}
                  </span>
                  {results.length > 0 && (
                    <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
                      {results.length} results collected
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">
                  {progress?.etaSeconds != null
                    ? `ETA: ${progress.etaSeconds >= 60
                        ? `${Math.floor(progress.etaSeconds / 60)}m ${progress.etaSeconds % 60}s`
                        : `${progress.etaSeconds}s`}`
                    : progress && progress.completed === 0
                      ? 'ETA: estimating…'
                      : ''}
                </span>
                <button
                  onClick={cancel}
                  className="btn-secondary px-3 py-2 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="relative h-2.5 overflow-hidden rounded-md bg-slate-200/70">
                <div
                  className="absolute left-0 top-0 h-full rounded-md bg-slate-900 transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(progress?.percent ?? 0, 6)}%`, opacity: (progress?.percent ?? 0) === 0 ? 0.18 : 1 }}
                />
                <div
                  className="pointer-events-none absolute inset-y-0 w-24 rounded-md bg-gradient-to-r from-transparent via-white/70 to-transparent"
                  style={{ animation: 'progressSweep 2.2s ease-in-out infinite' }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Live search execution</span>
                <span>{progress?.percent ?? 0}% complete</span>
              </div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-lg border px-4 py-3 text-sm" style={{ background: 'var(--danger-bg)', borderColor: 'rgba(185, 28, 28, 0.14)', color: 'var(--danger-text)' }}>
            {error}
          </div>
        )}

        {status === 'success' && results.length === 0 && (
          <div className="panel rounded-2xl py-10 text-center text-sm text-slate-500">
            No results found. Try a different keyword or location.
          </div>
        )}

        {results.length > 0 && (
          <ResultsTable
            results={results}
            sortConfig={sortConfig}
            onSort={handleSort}
          />
        )}
      </div>
    </main>
  );
}
