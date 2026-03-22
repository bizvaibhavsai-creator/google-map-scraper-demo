'use client';

import { useState, useCallback } from 'react';
import { SearchForm } from '@/components/SearchForm';
import { ResultsTable } from '@/components/ResultsTable';
import { useMapsSearch } from '@/hooks/useMapsSearch';
import { useSupabaseEnrichment } from '@/hooks/useSupabaseEnrichment';
import type { SortConfig, SortKey } from '@/types';

export default function HomePage() {
  const { results, status, error, progress, search, cancel } = useMapsSearch();
  const { contactsMap, insertAndEnrich } = useSupabaseEnrichment();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', dir: 'asc' });
  const [emailFilter, setEmailFilter] = useState<'all' | 'has_emails' | 'blank'>('all');

  const handleSort = useCallback((key: SortKey) => {
    setSortConfig((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  }, []);

  const handlePushToSupabase = useCallback(() => {
    if (results.length > 0) {
      insertAndEnrich(results);
    }
  }, [results, insertAndEnrich]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Google Maps Scraper</h1>
        <p className="text-sm text-gray-500 mt-1">
          Search businesses on Google Maps and extract contact information from their websites.
        </p>
      </div>

      <SearchForm onSearch={search} isLoading={status === 'loading'} />

      {status === 'loading' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">
              Scraping Google Maps… {progress ? `${progress.completed} / ${progress.total}` : ''}
            </span>
            <div className="flex items-center gap-3">
              {progress?.etaSeconds != null && (
                <span className="text-gray-500">
                  ETA: {progress.etaSeconds >= 60
                    ? `${Math.floor(progress.etaSeconds / 60)}m ${progress.etaSeconds % 60}s`
                    : `${progress.etaSeconds}s`}
                </span>
              )}
              <button
                onClick={cancel}
                className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress?.percent ?? 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">{progress?.percent ?? 0}% complete</p>
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

      {status === 'success' && results.length > 0 && (
        <ResultsTable
          results={results}
          sortConfig={sortConfig}
          onSort={handleSort}
          contactsMap={contactsMap}
          emailFilter={emailFilter}
          onEmailFilterChange={setEmailFilter}
          onPushToSupabase={handlePushToSupabase}
        />
      )}
    </main>
  );
}
