'use client';

import { useState, FormEvent } from 'react';
import type { SearchParams } from '@/types';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
  onSearch: (params: SearchParams) => void;
  isLoading: boolean;
}

export function SearchForm({ onSearch, isLoading }: Props) {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [country, setCountry] = useState('us');
  const [language, setLanguage] = useState('en');
  const [limit, setLimit] = useState(20);
  const [minReviews, setMinReviews] = useState('');
  const [maxReviews, setMaxReviews] = useState('');
  const [filterPermanentlyClosed, setFilterPermanentlyClosed] = useState<'any' | 'true' | 'false'>('any');
  const [filterTemporarilyClosed, setFilterTemporarilyClosed] = useState<'any' | 'true' | 'false'>('any');
  const [category, setCategory] = useState('');
  const [dedupeWebsite, setDedupeWebsite] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!keyword.trim() || !location.trim()) return;
    const parsedMinReviews = minReviews === '' ? 0 : Number(minReviews);
    const parsedMaxReviews = maxReviews === '' ? 0 : Number(maxReviews);
    const normalizedMinReviews = Math.max(0, Number.isFinite(parsedMinReviews) ? parsedMinReviews : 0);
    const normalizedMaxReviews = Math.max(0, Number.isFinite(parsedMaxReviews) ? parsedMaxReviews : 0);
    const [finalMinReviews, finalMaxReviews] =
      normalizedMaxReviews > 0 && normalizedMaxReviews < normalizedMinReviews
        ? [normalizedMaxReviews, normalizedMinReviews]
        : [normalizedMinReviews, normalizedMaxReviews];

    onSearch({
      keyword: keyword.trim(),
      location: location.trim(),
      country,
      language,
      limit,
      minReviews: finalMinReviews,
      maxReviews: finalMaxReviews,
      filterPermanentlyClosed,
      filterTemporarilyClosed,
      category: category.trim(),
      dedupeWebsite,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4"
    >
      <h2 className="text-lg font-semibold text-gray-800">Search Google Maps</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Keywords <span className="text-gray-400 font-normal">(comma-separated)</span></label>
          <input
            type="text"
            placeholder="e.g. restaurant, dentist"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            required
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Locations <span className="text-gray-400 font-normal">(comma-separated)</span></label>
          <input
            type="text"
            placeholder="e.g. New York, London, Paris"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Country code</label>
          <input
            type="text"
            placeholder="us"
            maxLength={2}
            value={country}
            onChange={(e) => setCountry(e.target.value.toLowerCase())}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Language code</label>
          <input
            type="text"
            placeholder="en"
            maxLength={2}
            value={language}
            onChange={(e) => setLanguage(e.target.value.toLowerCase())}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Result limit</label>
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Min. reviews</label>
          <input
            type="number"
            min={0}
            placeholder="Any"
            value={minReviews}
            onChange={(e) => setMinReviews(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Max. reviews</label>
          <input
            type="number"
            min={0}
            placeholder="Any"
            value={maxReviews}
            onChange={(e) => setMaxReviews(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Permanently closed</label>
          <select
            value={filterPermanentlyClosed}
            onChange={(e) => setFilterPermanentlyClosed(e.target.value as 'any' | 'true' | 'false')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="any">Any</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Temporarily closed</label>
          <select
            value={filterTemporarilyClosed}
            onChange={(e) => setFilterTemporarilyClosed(e.target.value as 'any' | 'true' | 'false')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="any">Any</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Category <span className="text-gray-400 font-normal">(optional)</span></label>
          <input
            type="text"
            placeholder="e.g. general contractor"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-600">Dedupe Results <span className="text-gray-400 font-normal">(on website)</span></label>
          <select
            value={dedupeWebsite ? 'yes' : 'no'}
            onChange={(e) => setDedupeWebsite(e.target.value === 'yes')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
      >
        {isLoading && <LoadingSpinner />}
        {isLoading ? 'Searching…' : 'Search'}
      </button>
    </form>
  );
}
