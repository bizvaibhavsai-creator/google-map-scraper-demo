'use client';

import { useState, useCallback, useRef } from 'react';
import type { ContactsState } from '@/types';

// 2 concurrent to stay within Vercel serverless limits
const CONCURRENCY = 2;
const MAX_RETRIES = 2;

interface QueueItem {
  businessId: string;
  website: string;
  retries: number;
}

export function useScrapeContacts() {
  const [contactsMap, setContactsMap] = useState<Record<string, ContactsState>>({});
  const initiated = useRef<Set<string>>(new Set());
  const queue = useRef<QueueItem[]>([]);
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
          const data = text ? JSON.parse(text) : { emails: [] };
          const emails: string[] = data.emails ?? [];

          // Retry if: API flagged an error OR emails came back empty and we have retries left
          if ((data.error || emails.length === 0) && item.retries < MAX_RETRIES) {
            queue.current.push({ ...item, retries: item.retries + 1 });
          } else {
            setContactsMap((prev) => ({
              ...prev,
              [item.businessId]: {
                status: 'success',
                data: { emails, phones: [] },
              },
            }));
          }
        } catch {
          if (item.retries < MAX_RETRIES) {
            queue.current.push({ ...item, retries: item.retries + 1 });
          } else {
            setContactsMap((prev) => ({
              ...prev,
              [item.businessId]: {
                status: 'success',
                data: { emails: [], phones: [] },
              },
            }));
          }
        } finally {
          running.current--;
          processQueue();
        }
      })();
    }
  }, []);

  const scrape = useCallback(
    (businessId: string, website: string) => {
      if (initiated.current.has(businessId)) return;
      initiated.current.add(businessId);
      queue.current.push({ businessId, website, retries: 0 });
      processQueue();
    },
    [processQueue],
  );

  return { contactsMap, scrape };
}
