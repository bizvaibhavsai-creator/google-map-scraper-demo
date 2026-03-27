'use client';

import { useState, useCallback, useRef } from 'react';
import type { ContactsState } from '@/types';

const WORKER_URL = process.env.NEXT_PUBLIC_EMAIL_WORKER_URL || 'http://localhost:3001';
const POLL_INTERVAL = 5000; // 5 seconds

export function useScrapeContacts() {
  const [contactsMap, setContactsMap] = useState<Record<string, ContactsState>>({});
  const sentRef = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCompletedRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const poll = useCallback(
    async (jobId: string) => {
      try {
        const res = await fetch(`${WORKER_URL}/enrich/${jobId}`);
        const data = await res.json();

        // Only update state when new results arrive
        if (data.completed > lastCompletedRef.current) {
          lastCompletedRef.current = data.completed;

          setContactsMap((prev) => {
            const next = { ...prev };
            for (const [bizId, result] of Object.entries(data.results)) {
              const r = result as { emails: string[] };
              next[bizId] = {
                status: 'success',
                data: { emails: r.emails, phones: [] },
              };
            }
            return next;
          });
        }

        if (data.status === 'complete') {
          stopPolling();
        }
      } catch {
        // silently retry on next interval
      }
    },
    [stopPolling],
  );

  const scrape = useCallback(
    (items: Array<{ businessId: string; website: string }>) => {
      const newItems = items.filter((i) => !sentRef.current.has(i.businessId));
      if (newItems.length === 0) return;

      newItems.forEach((i) => sentRef.current.add(i.businessId));

      // Mark all as loading in one batch
      setContactsMap((prev) => {
        const next = { ...prev };
        newItems.forEach((i) => {
          next[i.businessId] = { status: 'loading' };
        });
        return next;
      });

      // POST entire batch to Railway worker
      fetch(`${WORKER_URL}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: newItems }),
      })
        .then((res) => res.json())
        .then(({ jobId }) => {
          stopPolling();
          lastCompletedRef.current = 0;
          pollRef.current = setInterval(() => poll(jobId), POLL_INTERVAL);
          poll(jobId); // poll immediately too
        })
        .catch(() => {
          setContactsMap((prev) => {
            const next = { ...prev };
            newItems.forEach((i) => {
              next[i.businessId] = { status: 'success', data: { emails: [], phones: [] } };
            });
            return next;
          });
        });
    },
    [poll, stopPolling],
  );

  return { contactsMap, scrape };
}
