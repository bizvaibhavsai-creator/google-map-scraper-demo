'use client';

import { useState } from 'react';
import type { MapResult, ContactsState, SortConfig, SortKey } from '@/types';
import { ResultRow } from './ResultRow';

type EmailFilter = 'all' | 'has_emails' | 'blank';

interface Props {
  results: MapResult[];
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
  contactsMap: Record<string, ContactsState>;
  emailFilter: EmailFilter;
  onEmailFilterChange: (f: EmailFilter) => void;
  onPushToSupabase: () => void;
}

const IDLE: ContactsState = { status: 'idle' };

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className={`ml-1 text-xs ${active ? 'text-blue-600' : 'text-gray-400'}`}>
      {!active ? '↕' : dir === 'asc' ? '↑' : '↓'}
    </span>
  );
}

function SortableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sortConfig: SortConfig;
  onSort: (k: SortKey) => void;
}) {
  const active = sortConfig.key === sortKey;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-blue-600"
      onClick={() => onSort(sortKey)}
    >
      {label}
      <SortIcon active={active} dir={sortConfig.dir} />
    </th>
  );
}

function exportToCsv(results: MapResult[], contactsMap: Record<string, ContactsState>) {
  const headers = ['Name', 'Category', 'Status', 'Keyword', 'Location', 'Address', 'Phone', 'Rating', 'Reviews', 'Website', 'Emails'];

  const escape = (val: string | number | null | undefined) => {
    if (val == null) return '';
    const str = String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const rows = results.map((r) => {
    const contacts = contactsMap[r.business_id];
    const emails = contacts?.status === 'success' ? contacts.data.emails.join('; ') : '';
    const category = Array.isArray(r.types) ? r.types.join(', ') : (r.types || '');
    const status = r.is_permanently_closed ? 'Permanently Closed' : r.is_temporarily_closed ? 'Temporarily Closed' : 'Open';
    return [r.name, category, status, r._keyword, r._location, r.full_address, r.phone_number, r.rating, r.review_count, r.website, emails]
      .map(escape)
      .join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'google-maps-results.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function buildRowPayload(r: MapResult, contactsMap: Record<string, ContactsState>) {
  const contacts = contactsMap[r.business_id];
  const emails = contacts?.status === 'success' ? contacts.data.emails : [];
  const category = Array.isArray(r.types) ? r.types.join(', ') : (r.types || '');
  const closedStatus = r.is_permanently_closed ? 'Permanently Closed' : r.is_temporarily_closed ? 'Temporarily Closed' : 'Open';
  return {
    name: r.name,
    category,
    status: closedStatus,
    keyword: r._keyword,
    location: r._location,
    address: r.full_address,
    phone: r.phone_number,
    rating: r.rating,
    reviews: r.review_count,
    website: r.website,
    emails,
  };
}

async function pushToClay(
  webhookUrl: string,
  results: MapResult[],
  contactsMap: Record<string, ContactsState>,
  onProgress: (sent: number, total: number) => void,
) {
  const total = results.length;
  for (let i = 0; i < total; i++) {
    const payload = buildRowPayload(results[i], contactsMap);
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    });
    onProgress(i + 1, total);
    // 1 row per second to stay within Clay webhook limits
    if (i < total - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export function ResultsTable({ results, sortConfig, onSort, contactsMap, emailFilter, onEmailFilterChange, onPushToSupabase }: Props) {
  const [supabasePushed, setSupabasePushed] = useState(false);
  const [clayModal, setClayModal] = useState(false);
  const [clayWebhook, setClayWebhook] = useState('');
  const [clayProgress, setClayProgress] = useState<{ sent: number; total: number } | null>(null);
  const [clayDone, setClayDone] = useState(false);

  // Apply email filter
  const filtered = emailFilter === 'all'
    ? results
    : results.filter((r) => {
        const cs = contactsMap[r.business_id];
        const hasEmails = cs?.status === 'success' && cs.data.emails.length > 0;
        return emailFilter === 'has_emails' ? hasEmails : !hasEmails;
      });

  const sorted = [...filtered].sort((a, b) => {
    const key = sortConfig.key;
    const aVal = a[key] ?? (key === 'name' ? '' : -Infinity);
    const bVal = b[key] ?? (key === 'name' ? '' : -Infinity);
    if (aVal < bVal) return sortConfig.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSupabase = () => {
    onPushToSupabase();
    setSupabasePushed(true);
  };

  const handleClayStart = async () => {
    if (!clayWebhook.trim()) return;
    setClayModal(false);
    setClayDone(false);
    setClayProgress({ sent: 0, total: results.length });
    await pushToClay(clayWebhook.trim(), results, contactsMap, (sent, total) => {
      setClayProgress({ sent, total });
    });
    setClayDone(true);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{filtered.length} of {results.length} results</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCsv(results, contactsMap)}
            className="flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={handleSupabase}
            disabled={supabasePushed}
            className="flex items-center gap-1.5 text-sm bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            {supabasePushed ? 'Pushed to Supabase' : 'Push to Supabase'}
          </button>
          <button
            onClick={() => setClayModal(true)}
            disabled={clayProgress !== null && !clayDone}
            className="flex items-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            {clayProgress && !clayDone
              ? `Pushing to Clay… ${clayProgress.sent}/${clayProgress.total}`
              : clayDone
                ? 'Pushed to Clay'
                : 'Push to Clay'}
          </button>
        </div>
      </div>

      {/* Clay webhook modal */}
      {clayModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Push to Clay</h3>
            <p className="text-sm text-gray-500">
              Enter your Clay webhook URL. Rows will be sent one per second.
            </p>
            <input
              type="url"
              placeholder="https://api.clay.com/v1/webhooks/..."
              value={clayWebhook}
              onChange={(e) => setClayWebhook(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setClayModal(false)}
                className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClayStart}
                disabled={!clayWebhook.trim()}
                className="text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Start Push ({results.length} rows)
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
        <table className="w-full table-fixed min-w-[1350px]">
          <colgroup>
            <col className="w-[140px]" />
            <col className="w-[130px]" />
            <col className="w-[120px]" />
            <col className="w-[100px]" />
            <col className="w-[100px]" />
            <col className="w-[150px]" />
            <col className="w-[110px]" />
            <col className="w-[65px]" />
            <col className="w-[70px]" />
            <col className="w-[120px]" />
            <col className="w-[180px]" />
          </colgroup>
          <thead className="sticky top-0 bg-gray-50 z-10 border-b border-gray-200">
            <tr>
              <SortableHeader label="Name" sortKey="name" sortConfig={sortConfig} onSort={onSort} />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Category</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Keyword</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Location</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Address</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Phone</th>
              <SortableHeader label="Rating" sortKey="rating" sortConfig={sortConfig} onSort={onSort} />
              <SortableHeader label="Reviews" sortKey="review_count" sortConfig={sortConfig} onSort={onSort} />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Website</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                <div className="flex items-center gap-2">
                  Email
                  <select
                    value={emailFilter}
                    onChange={(e) => onEmailFilterChange(e.target.value as EmailFilter)}
                    className="text-xs font-normal normal-case tracking-normal border border-gray-300 rounded px-1.5 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="has_emails">Has Emails</option>
                    <option value="blank">Blank</option>
                  </select>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((result) => (
              <ResultRow
                key={result.business_id}
                result={result}
                contactsState={contactsMap[result.business_id] ?? IDLE}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
