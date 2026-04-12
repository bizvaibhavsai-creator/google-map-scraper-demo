'use client';

import { useState, useCallback } from 'react';
import { SearchForm } from '@/components/SearchForm';
import { ResultsTable } from '@/components/ResultsTable';
import { useMapsSearch } from '@/hooks/useMapsSearch';
// import { useScrapeContacts } from '@/hooks/useScrapeContacts';
import type { SortConfig, SortKey } from '@/types';

export default function HomePage() {
  const { results, status, error, progress, search, cancel } = useMapsSearch();
  // const { contactsMap, scrape } = useScrapeContacts();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', dir: 'asc' });

  const handleSort = useCallback((key: SortKey) => {
    setSortConfig((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  }, []);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Google Maps Scraper</h1>
        <p className="text-sm text-gray-500 mt-1">
          Search businesses on Google Maps.
        </p>
      </div>

      <SearchForm onSearch={search} isLoading={status === 'loading'} />

      {status === 'loading' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">
              Scraping Google Maps… {progress ? `${progress.completed} / ${progress.total} pairs` : 'preparing…'}
              {results.length > 0 && <span className="text-gray-500 font-normal"> · {results.length} results</span>}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-gray-500">
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
                className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden relative">
            {(progress?.percent ?? 0) === 0 ? (
              /* Pulsing shimmer animation while waiting for first batch */
              <div
                className="h-full rounded-full absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, #3b82f6 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s ease-in-out infinite',
                }}
              />
            ) : (
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress?.percent ?? 0}%` }}
              />
            )}
          </div>
          <p className="text-xs text-gray-400">{progress?.percent ?? 0}% complete</p>
          <style jsx>{`
            @keyframes shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {status === 'success' && results.length === 0 && (
        <div className="text-sm text-gray-500 text-center py-8">No results found. Try a different keyword or location.</div>
      )}

      {results.length > 0 && (
        <ResultsTable
          results={results}
          sortConfig={sortConfig}
          onSort={handleSort}
        />
      )}
    </main>
  );
}
