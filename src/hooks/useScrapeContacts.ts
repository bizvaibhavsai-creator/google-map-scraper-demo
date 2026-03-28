'use client';

import { useState, useCallback, useRef } from 'react';
import type { ContactsState } from '@/types';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
const CONCURRENCY = 4;

async function fetchEmails(website: string): Promise<string[]> {
  const url = new URL(`${WORKER_URL}/api/enrich`);
  url.searchParams.set('website', website);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.emails) ? data.emails : [];
  } catch {
    return [];
  }
}

export function useScrapeContacts() {
  const [contactsMap, setContactsMap] = useState<Record<string, ContactsState>>({});
  const sentRef = useRef<Set<string>>(new Set());

  const scrape = useCallback(
    (items: Array<{ businessId: string; website: string }>) => {
      const newItems = items.filter((i) => !sentRef.current.has(i.businessId));
      if (newItems.length === 0) return;

      newItems.forEach((i) => sentRef.current.add(i.businessId));

      // Mark all as loading
      setContactsMap((prev) => {
        const next = { ...prev };
        newItems.forEach((i) => {
          next[i.businessId] = { status: 'loading' };
        });
        return next;
      });

      // Process with concurrency limit
      let index = 0;

      async function worker() {
        while (index < newItems.length) {
          const i = index++;
          const item = newItems[i];
          const emails = await fetchEmails(item.website);

          setContactsMap((prev) => ({
            ...prev,
            [item.businessId]: {
              status: 'success',
              data: { emails, phones: [] },
            },
          }));
        }
      }

      const workers = Array.from(
        { length: Math.min(CONCURRENCY, newItems.length) },
        () => worker(),
      );
      Promise.all(workers).catch(() => {});
    },
    [],
  );

  return { contactsMap, scrape };
}
