'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface BusinessRow {
  id: string;
  business_id: string;
  name: string;
  types: string | null;
  is_permanently_closed: boolean;
  is_temporarily_closed: boolean;
  keyword: string | null;
  location: string | null;
  full_address: string | null;
  phone_number: string | null;
  rating: number | null;
  review_count: number | null;
  website: string | null;
  emails: string[];
  enrichment_status: string;
  created_at: string;
}

type EnrichState = 'idle' | 'enriching' | 'done';

export default function SupabaseDashboard() {
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrichState, setEnrichState] = useState<EnrichState>('idle');
  const [enrichProgress, setEnrichProgress] = useState<{ processed: number; remaining: number } | null>(null);
  const abortRef = useRef(false);

  // Clay
  const [clayModal, setClayModal] = useState(false);
  const [clayWebhook, setClayWebhook] = useState('');
  const [clayProgress, setClayProgress] = useState<{ sent: number; total: number } | null>(null);
  const [clayDone, setClayDone] = useState(false);

  // Load data
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);
      setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // Subscribe to real-time updates (emails enrichment)
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'businesses' },
        (payload) => {
          const updated = payload.new as BusinessRow;
          setRows((prev) =>
            prev.map((r) => (r.business_id === updated.business_id ? { ...r, ...updated } : r))
          );
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Enrich emails
  const startEnrichment = async () => {
    abortRef.current = false;
    setEnrichState('enriching');
    setEnrichProgress(null);

    let totalProcessed = 0;
    let remaining = 1;

    while (remaining > 0 && !abortRef.current) {
      try {
        const res = await fetch('/api/enrich-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        totalProcessed += data.processed ?? 0;
        remaining = data.remaining ?? 0;
        setEnrichProgress({ processed: totalProcessed, remaining });

        if (remaining > 0 && !abortRef.current) {
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch {
        break;
      }
    }
    setEnrichState('done');
  };

  const cancelEnrichment = () => { abortRef.current = true; };

  // Export CSV
  const exportCsv = () => {
    const headers = ['Name', 'Category', 'Status', 'Keyword', 'Location', 'Address', 'Phone', 'Rating', 'Reviews', 'Website', 'Emails', 'Enrichment Status'];
    const escape = (val: string | number | null | undefined) => {
      if (val == null) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };
    const csvRows = rows.map((r) => {
      const status = r.is_permanently_closed ? 'Permanently Closed' : r.is_temporarily_closed ? 'Temporarily Closed' : 'Open';
      const emails = (r.emails ?? []).join(', ');
      return [r.name, r.types, status, r.keyword, r.location, r.full_address, r.phone_number, r.rating, r.review_count, r.website, emails, r.enrichment_status]
        .map(escape)
        .join(',');
    });
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supabase-businesses.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Push to Clay
  const pushToClay = async () => {
    if (!clayWebhook.trim()) return;
    setClayModal(false);
    setClayDone(false);
    const total = rows.length;
    setClayProgress({ sent: 0, total });

    for (let i = 0; i < total; i++) {
      const r = rows[i];
      const status = r.is_permanently_closed ? 'Permanently Closed' : r.is_temporarily_closed ? 'Temporarily Closed' : 'Open';
      const payload = {
        name: r.name,
        category: r.types,
        status,
        keyword: r.keyword,
        location: r.location,
        address: r.full_address,
        phone: r.phone_number,
        rating: r.rating,
        reviews: r.review_count,
        website: r.website,
        emails: (r.emails ?? []).join(', '),
      };
      await fetch(clayWebhook.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
      });
      setClayProgress({ sent: i + 1, total });
      if (i < total - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    setClayDone(true);
  };

  const pendingCount = rows.filter((r) => r.enrichment_status === 'pending').length;
  const doneCount = rows.filter((r) => r.enrichment_status === 'done').length;

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-500 text-sm">Loading Supabase data…</p>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supabase Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {rows.length} rows — {doneCount} enriched — {pendingCount} pending
          </p>
        </div>
        <a href="/" className="text-sm text-blue-600 hover:underline">Back to Scraper</a>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {enrichState === 'idle' && pendingCount > 0 && (
          <button
            onClick={startEnrichment}
            className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Enrich Emails ({pendingCount} pending)
          </button>
        )}
        {enrichState === 'enriching' && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-indigo-700 font-medium">
              Enriching… {enrichProgress ? `${enrichProgress.processed} done, ${enrichProgress.remaining} remaining` : ''}
            </span>
            <button
              onClick={cancelEnrichment}
              className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors"
            >
              Stop
            </button>
          </div>
        )}
        {enrichState === 'done' && (
          <span className="text-sm text-green-700 font-medium">Enrichment complete</span>
        )}

        <button
          onClick={exportCsv}
          className="text-sm bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Export CSV
        </button>

        <button
          onClick={() => setClayModal(true)}
          disabled={clayProgress !== null && !clayDone}
          className="text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {clayProgress && !clayDone
            ? `Pushing to Clay… ${clayProgress.sent}/${clayProgress.total}`
            : clayDone
              ? 'Pushed to Clay'
              : 'Push to Clay'}
        </button>
      </div>

      {/* Clay webhook modal */}
      {clayModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Push to Clay</h3>
            <p className="text-sm text-gray-500">Enter your Clay webhook URL. Rows will be sent one per second, including enriched emails.</p>
            <input
              type="url"
              placeholder="https://api.clay.com/v1/webhooks/..."
              value={clayWebhook}
              onChange={(e) => setClayWebhook(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setClayModal(false)} className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg">Cancel</button>
              <button
                onClick={pushToClay}
                disabled={!clayWebhook.trim()}
                className="text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Start Push ({rows.length} rows)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full table-fixed min-w-[1400px]">
            <colgroup>
              <col className="w-[140px]" />
              <col className="w-[120px]" />
              <col className="w-[100px]" />
              <col className="w-[90px]" />
              <col className="w-[100px]" />
              <col className="w-[150px]" />
              <col className="w-[100px]" />
              <col className="w-[60px]" />
              <col className="w-[60px]" />
              <col className="w-[120px]" />
              <col className="w-[200px]" />
              <col className="w-[80px]" />
            </colgroup>
            <thead className="sticky top-0 bg-gray-50 z-10 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Keyword</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Location</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Address</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rating</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reviews</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Website</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Emails</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Enriched</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = r.is_permanently_closed
                  ? 'Permanently Closed'
                  : r.is_temporarily_closed
                    ? 'Temporarily Closed'
                    : 'Open';
                const emails = (r.emails ?? []).join(', ');
                return (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{r.name}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{r.types || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block text-xs rounded px-2 py-0.5 ${
                        r.is_permanently_closed ? 'bg-red-100 text-red-700'
                          : r.is_temporarily_closed ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                      }`}>{status}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.keyword || '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.location || '—'}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{r.full_address || '—'}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{r.phone_number || '—'}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{r.rating ?? '—'}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{r.review_count ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-blue-600 break-all">
                      {r.website ? (
                        <a href={r.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {r.website.replace(/^https?:\/\//, '')}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700 break-all">{emails || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block text-xs rounded px-2 py-0.5 ${
                        r.enrichment_status === 'done' ? 'bg-green-100 text-green-700'
                          : r.enrichment_status === 'processing' ? 'bg-blue-100 text-blue-700'
                            : r.enrichment_status === 'error' ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                      }`}>{r.enrichment_status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
