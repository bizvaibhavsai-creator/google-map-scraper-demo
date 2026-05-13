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

    const normalizedLimit = Math.max(1, Number.isFinite(limit) ? limit : 20);
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
      limit: normalizedLimit,
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
      className="panel rounded-2xl p-6 sm:p-7 lg:p-8"
      style={{ animation: 'panelRise 0.45s ease-out both' }}
    >
      <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-5">
        <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">Search Configuration</h2>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Keywords <span className="font-normal text-slate-400">(comma-separated)</span></label>
          <input
            type="text"
            placeholder="e.g. restaurant, dentist"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            required
            className="field-shell"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Locations <span className="font-normal text-slate-400">(comma-separated)</span></label>
          <input
            type="text"
            placeholder="e.g. New York, London, Paris"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            className="field-shell"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Country code</label>
          <input
            type="text"
            placeholder="us"
            maxLength={2}
            value={country}
            onChange={(e) => setCountry(e.target.value.toLowerCase())}
            className="field-shell"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Language code</label>
          <input
            type="text"
            placeholder="en"
            maxLength={2}
            value={language}
            onChange={(e) => setLanguage(e.target.value.toLowerCase())}
            className="field-shell"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Result limit</label>
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(Math.max(1, Number(e.target.value)))}
            className="field-shell"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Min. reviews</label>
          <input
            type="number"
            min={0}
            placeholder="Any"
            value={minReviews}
            onChange={(e) => setMinReviews(e.target.value)}
            className="field-shell"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Max. reviews</label>
          <input
            type="number"
            min={0}
            placeholder="Any"
            value={maxReviews}
            onChange={(e) => setMaxReviews(e.target.value)}
            className="field-shell"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Permanently closed</label>
          <select
            value={filterPermanentlyClosed}
            onChange={(e) => setFilterPermanentlyClosed(e.target.value as 'any' | 'true' | 'false')}
            className="field-shell"
          >
            <option value="any">Any</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Temporarily closed</label>
          <select
            value={filterTemporarilyClosed}
            onChange={(e) => setFilterTemporarilyClosed(e.target.value as 'any' | 'true' | 'false')}
            className="field-shell"
          >
            <option value="any">Any</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Category <span className="font-normal text-slate-400">(optional)</span></label>
          <input
            type="text"
            placeholder="e.g. general contractor"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="field-shell"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Dedupe Results <span className="font-normal text-slate-400">(on website)</span></label>
          <select
            value={dedupeWebsite ? 'yes' : 'no'}
            onChange={(e) => setDedupeWebsite(e.target.value === 'yes')}
            className="field-shell"
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-4 border-t border-slate-200/80 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm leading-6 text-slate-500">Searches run across every keyword and location pair.</p>
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary min-w-[148px]"
        >
          {isLoading && <LoadingSpinner />}
          {isLoading ? 'Searching…' : 'Run Search'}
        </button>
      </div>
    </form>
  );
}
