'use client';

import { useState, useCallback, useEffect } from 'react';
import { SearchForm } from '@/components/SearchForm';
import { ResultsTable } from '@/components/ResultsTable';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useMapsSearch } from '@/hooks/useMapsSearch';
import { useScrapeContacts } from '@/hooks/useScrapeContacts';
import type { SortConfig, SortKey } from '@/types';

export default function HomePage() {
  const { results, status, error, search } = useMapsSearch();
  const { contactsMap, scrape } = useScrapeContacts();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', dir: 'asc' });

  useEffect(() => {
    results.forEach((r) => {
      if (r.website) scrape(r.business_id, r.website);
    });
  }, [results, scrape]);

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
          Search businesses on Google Maps and extract contact information from their websites.
        </p>
      </div>

      <SearchForm onSearch={search} isLoading={status === 'loading'} />

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <LoadingSpinner size="md" />
          <span>Searching Google Maps…</span>
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
        />
      )}
    </main>
  );
}
