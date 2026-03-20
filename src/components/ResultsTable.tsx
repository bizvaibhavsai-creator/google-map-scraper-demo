'use client';

import type { MapResult, ContactsState, SortConfig, SortKey } from '@/types';
import { ResultRow } from './ResultRow';

interface Props {
  results: MapResult[];
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
  contactsMap: Record<string, ContactsState>;
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
  const headers = ['Name', 'Keyword', 'Location', 'Type', 'Address', 'Phone', 'Rating', 'Reviews', 'Website', 'Emails'];

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
    return [r.name, r._keyword, r._location, r.type, r.full_address, r.phone_number, r.rating, r.review_count, r.website, emails]
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

export function ResultsTable({ results, sortConfig, onSort, contactsMap }: Props) {
  const sorted = [...results].sort((a, b) => {
    const key = sortConfig.key;
    const aVal = a[key] ?? (key === 'name' ? '' : -Infinity);
    const bVal = b[key] ?? (key === 'name' ? '' : -Infinity);
    if (aVal < bVal) return sortConfig.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.dir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{results.length} results</span>
        <button
          onClick={() => exportToCsv(results, contactsMap)}
          className="flex items-center gap-1.5 text-sm bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          ↓ Export CSV
        </button>
      </div>
      <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
        <table className="w-full table-fixed min-w-[1050px]">
          <colgroup>
            <col className="w-[160px]" />
            <col className="w-[110px]" />
            <col className="w-[110px]" />
            <col className="w-[170px]" />
            <col className="w-[120px]" />
            <col className="w-[70px]" />
            <col className="w-[70px]" />
            <col className="w-[140px]" />
            <col className="w-[200px]" />
          </colgroup>
          <thead className="sticky top-0 bg-gray-50 z-10 border-b border-gray-200">
            <tr>
              <SortableHeader label="Name" sortKey="name" sortConfig={sortConfig} onSort={onSort} />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Keyword</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Location</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Address</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Phone</th>
              <SortableHeader label="Rating" sortKey="rating" sortConfig={sortConfig} onSort={onSort} />
              <SortableHeader label="Reviews" sortKey="review_count" sortConfig={sortConfig} onSort={onSort} />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Website</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</th>
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
