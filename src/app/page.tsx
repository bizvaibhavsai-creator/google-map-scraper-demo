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
      <section className="panel rounded-[28px] px-6 py-8 sm:px-8 lg:px-10 lg:py-10" style={{ animation: 'panelRise 0.5s ease-out both' }}>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex w-fit items-center rounded-full border border-slate-200/80 bg-white/75 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
              Operations Console
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-4xl">
                Google Maps lead extraction in a quieter, enterprise-ready workspace.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">
                Configure targeted searches, monitor execution with restrained motion, and review export-ready business data in a cleaner operational interface.
              </p>
            </div>
          </div>

          <div className="grid w-full max-w-xl grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white/78 px-4 py-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">Search Mode</p>
              <p className="mt-2 text-sm font-medium text-slate-900">Keyword and location pairs</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/78 px-4 py-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">Output</p>
              <p className="mt-2 text-sm font-medium text-slate-900">Live table and CSV export</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 space-y-6">
        <SearchForm onSearch={search} isLoading={status === 'loading'} />

        {status === 'loading' && (
          <div className="panel rounded-[24px] p-5 sm:p-6" style={{ animation: 'panelRise 0.45s ease-out both' }}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Search Progress</p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">
                    Scraping Google Maps {progress ? `${progress.completed} / ${progress.total} pairs` : 'preparing'}
                  </span>
                  {results.length > 0 && (
                    <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-xs text-slate-600">
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
              <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-200/70">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-slate-900 transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(progress?.percent ?? 0, 6)}%`, opacity: (progress?.percent ?? 0) === 0 ? 0.18 : 1 }}
                />
                <div
                  className="pointer-events-none absolute inset-y-0 w-24 rounded-full bg-gradient-to-r from-transparent via-white/70 to-transparent"
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
          <div className="rounded-2xl border px-4 py-3 text-sm" style={{ background: 'var(--danger-bg)', borderColor: 'rgba(185, 28, 28, 0.14)', color: 'var(--danger-text)' }}>
            {error}
          </div>
        )}

        {status === 'success' && results.length === 0 && (
          <div className="panel rounded-[24px] py-10 text-center text-sm text-slate-500">
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
