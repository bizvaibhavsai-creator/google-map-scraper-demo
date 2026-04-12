'use client';

import { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { MapResult, ContactsState, SortConfig, SortKey } from '@/types';
import { ResultRow } from './ResultRow';

type EmailFilter = 'all' | 'has_emails' | 'blank';

const ENABLE_EMAILS = false;

interface Props {
  results: MapResult[];
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
  contactsMap?: Record<string, ContactsState>;
  emailFilter?: EmailFilter;
  onEmailFilterChange?: (f: EmailFilter) => void;
}

const IDLE: ContactsState = { status: 'idle' };

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className={`ml-1 text-xs ${active ? 'text-slate-900' : 'text-slate-400'}`}>
      {!active ? '↕' : dir === 'asc' ? '↑' : '↓'}
    </span>
  );
}

function SortableHeader({
  label, sortKey, sortConfig, onSort,
}: { label: string; sortKey: SortKey; sortConfig: SortConfig; onSort: (k: SortKey) => void }) {
  const active = sortConfig.key === sortKey;
  return (
    <th
      className="cursor-pointer select-none whitespace-nowrap px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-slate-900"
      onClick={() => onSort(sortKey)}
    >
      {label}
      <SortIcon active={active} dir={sortConfig.dir} />
    </th>
  );
}

function exportToCsv(results: MapResult[], contactsMap?: Record<string, ContactsState>) {
  const headers = ['Name', 'Category', 'Status', 'Keyword', 'Location', 'Address', 'Phone', 'Rating', 'Reviews', 'Website'];
  if (ENABLE_EMAILS) headers.push('Emails');

  const escape = (val: string | number | null | undefined) => {
    if (val == null) return '';
    const str = String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const rows = results.map((r) => {
    const category = Array.isArray(r.types) ? r.types.join(', ') : (r.types || '');
    const status = r.is_permanently_closed ? 'Permanently Closed' : r.is_temporarily_closed ? 'Temporarily Closed' : 'Open';
    const cols: (string | number | null | undefined)[] = [r.name, category, status, r._keyword, r._location, r.full_address, r.phone_number, r.rating, r.review_count, r.website];
    if (ENABLE_EMAILS && contactsMap) {
      const contacts = contactsMap[r.business_id];
      cols.push(contacts?.status === 'success' ? contacts.data.emails.join('; ') : '');
    }
    return cols.map(escape).join(',');
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

function buildRowPayload(r: MapResult, contactsMap?: Record<string, ContactsState>) {
  const category = Array.isArray(r.types) ? r.types.join(', ') : (r.types || '');
  const closedStatus = r.is_permanently_closed ? 'Permanently Closed' : r.is_temporarily_closed ? 'Temporarily Closed' : 'Open';
  const payload: Record<string, unknown> = {
    name: r.name, category, status: closedStatus, keyword: r._keyword, location: r._location,
    address: r.full_address, phone: r.phone_number, rating: r.rating, reviews: r.review_count,
    website: r.website,
  };
  if (ENABLE_EMAILS && contactsMap) {
    const contacts = contactsMap[r.business_id];
    payload.emails = contacts?.status === 'success' ? contacts.data.emails.join(', ') : '';
  }
  return payload;
}

async function pushToClay(
  webhookUrl: string, results: MapResult[], contactsMap: Record<string, ContactsState> | undefined,
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
    if (i < total - 1) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export function ResultsTable({ results, sortConfig, onSort, contactsMap, emailFilter = 'all', onEmailFilterChange }: Props) {
  const [clayModal, setClayModal] = useState(false);
  const [clayWebhook, setClayWebhook] = useState('');
  const [clayProgress, setClayProgress] = useState<{ sent: number; total: number } | null>(null);
  const [clayDone, setClayDone] = useState(false);

  const filtered = (ENABLE_EMAILS && emailFilter !== 'all' && contactsMap)
    ? results.filter((r) => {
        const cs = contactsMap[r.business_id];
        const hasEmails = cs?.status === 'success' && cs.data.emails.length > 0;
        return emailFilter === 'has_emails' ? hasEmails : !hasEmails;
      })
    : results;

  const sorted = [...filtered].sort((a, b) => {
    const key = sortConfig.key;
    const aVal = a[key] ?? (key === 'name' ? '' : -Infinity);
    const bVal = b[key] ?? (key === 'name' ? '' : -Infinity);
    if (aVal < bVal) return sortConfig.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.dir === 'asc' ? 1 : -1;
    return 0;
  });

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
    <div className="panel rounded-2xl overflow-hidden" style={{ animation: 'panelRise 0.5s ease-out both' }}>
      <div className="flex flex-col gap-4 border-b border-slate-200/80 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">Results Workspace</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold tracking-[-0.03em] text-slate-900">{filtered.length} records</span>
            <span className="rounded-md border border-slate-200/80 bg-white px-2.5 py-1 text-xs text-slate-500">
              {results.length} total collected
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportToCsv(results, contactsMap)}
            className="btn-secondary"
          >
            Export CSV
          </button>
          <button
            onClick={() => setClayModal(true)}
            disabled={clayProgress !== null && !clayDone}
            className="btn-primary px-4 py-2.5"
          >
            {clayProgress && !clayDone
              ? `Pushing to Clay… ${clayProgress.sent}/${clayProgress.total}`
              : clayDone ? 'Pushed to Clay' : 'Push to Clay'}
          </button>
        </div>
      </div>

      {clayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="panel-strong w-full max-w-md rounded-xl p-6 shadow-xl">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">Outbound Delivery</p>
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">Push to Clay</h3>
              <p className="text-sm leading-6 text-slate-600">Enter your Clay webhook URL. Rows will be sent one per second.</p>
            </div>
            <input
              type="url"
              placeholder="https://api.clay.com/v1/webhooks/..."
              value={clayWebhook}
              onChange={(e) => setClayWebhook(e.target.value)}
              className="field-shell mt-5 w-full"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setClayModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleClayStart} disabled={!clayWebhook.trim()} className="btn-primary px-4 py-2.5">
                Start Push ({results.length} rows)
              </button>
            </div>
          </div>
        </div>
      )}

      <VirtualTable
        sorted={sorted}
        sortConfig={sortConfig}
        onSort={onSort}
        contactsMap={contactsMap}
        emailFilter={emailFilter}
        onEmailFilterChange={onEmailFilterChange}
      />
    </div>
  );
}

const ROW_HEIGHT = 60;
const OVERSCAN = 10;

function VirtualTable({
  sorted, sortConfig, onSort, contactsMap, emailFilter, onEmailFilterChange,
}: {
  sorted: MapResult[];
  sortConfig: SortConfig;
  onSort: (k: SortKey) => void;
  contactsMap?: Record<string, ContactsState>;
  emailFilter?: EmailFilter;
  onEmailFilterChange?: (f: EmailFilter) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  return (
    <div ref={scrollRef} className="max-h-[65vh] overflow-x-auto overflow-y-auto px-2 pb-2">
      <table className="min-w-[1200px] w-full table-fixed">
        <colgroup>
          <col className="w-[160px]" />
          <col className="w-[140px]" />
          <col className="w-[120px]" />
          <col className="w-[110px]" />
          <col className="w-[120px]" />
          <col className="w-[190px]" />
          <col className="w-[120px]" />
          <col className="w-[80px]" />
          <col className="w-[90px]" />
          <col className="w-[170px]" />
          {ENABLE_EMAILS && <col className="w-[200px]" />}
        </colgroup>
        <thead className="sticky top-0 z-10 border-b border-slate-200/80 bg-[rgba(245,246,241,0.94)] backdrop-blur">
          <tr>
            <SortableHeader label="Name" sortKey="name" sortConfig={sortConfig} onSort={onSort} />
            <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Category</th>
            <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status</th>
            <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Keyword</th>
            <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Location</th>
            <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Address</th>
            <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Phone</th>
            <SortableHeader label="Rating" sortKey="rating" sortConfig={sortConfig} onSort={onSort} />
            <SortableHeader label="Reviews" sortKey="review_count" sortConfig={sortConfig} onSort={onSort} />
            <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Website</th>
            {ENABLE_EMAILS && (
              <th className="px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <div className="flex items-center gap-2">
                  Emails
                  {onEmailFilterChange && (
                    <select
                      value={emailFilter}
                      onChange={(e) => onEmailFilterChange(e.target.value as EmailFilter)}
                      className="field-shell px-2 py-1 text-xs font-normal normal-case tracking-normal"
                    >
                      <option value="all">All</option>
                      <option value="has_emails">Has Emails</option>
                      <option value="blank">Blank</option>
                    </select>
                  )}
                </div>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {virtualizer.getVirtualItems().length > 0 && (
            <tr><td style={{ height: virtualizer.getVirtualItems()[0].start, padding: 0 }} /></tr>
          )}
          {virtualizer.getVirtualItems().map((vRow) => {
            const result = sorted[vRow.index];
            return (
              <ResultRow
                key={result.business_id}
                result={result}
                contactsState={ENABLE_EMAILS ? (contactsMap?.[result.business_id] ?? IDLE) : undefined}
              />
            );
          })}
          {virtualizer.getVirtualItems().length > 0 && (
            <tr>
              <td
                style={{
                  height: virtualizer.getTotalSize() - (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
                  padding: 0,
                }}
              />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
