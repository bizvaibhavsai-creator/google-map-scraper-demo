'use client';

import { useState, useCallback, useRef } from 'react';
import type { ContactsState } from '@/types';

const CONCURRENCY = 3; // max simultaneous contact scrapes

export function useScrapeContacts() {
  const [contactsMap, setContactsMap] = useState<Record<string, ContactsState>>({});
  const initiated = useRef<Set<string>>(new Set());
  const queue = useRef<{ businessId: string; website: string }[]>([]);
  const running = useRef(0);

  const processQueue = useCallback(() => {
    while (running.current < CONCURRENCY && queue.current.length > 0) {
      const item = queue.current.shift()!;
      running.current++;

      (async () => {
        setContactsMap((prev) => ({ ...prev, [item.businessId]: { status: 'loading' } }));

        try {
          const qs = new URLSearchParams({ website: item.website });
          const res = await fetch(`/api/scrape-contacts?${qs}`);

          const text = await res.text();
          if (!res.ok) throw new Error(text ? JSON.parse(text).error : `Request failed: ${res.status}`);

          const data = text ? JSON.parse(text) : { emails: [] };

          setContactsMap((prev) => ({
            ...prev,
            [item.businessId]: { status: 'success', data: { emails: data.emails ?? [], phones: [] } },
          }));
        } catch (err) {
          initiated.current.delete(item.businessId);
          setContactsMap((prev) => ({
            ...prev,
            [item.businessId]: { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' },
          }));
        } finally {
          running.current--;
          processQueue();
        }
      })();
    }
  }, []);

  const scrape = useCallback((businessId: string, website: string) => {
    if (initiated.current.has(businessId)) return;
    initiated.current.add(businessId);
    queue.current.push({ businessId, website });
    processQueue();
  }, [processQueue]);

  return { contactsMap, scrape };
}
