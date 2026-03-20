'use client';

import { useState, useCallback, useRef } from 'react';
import type { ContactsState } from '@/types';

export function useScrapeContacts() {
  const [contactsMap, setContactsMap] = useState<Record<string, ContactsState>>({});
  const initiated = useRef<Set<string>>(new Set());

  const scrape = useCallback(async (businessId: string, website: string) => {
    if (initiated.current.has(businessId)) return;
    initiated.current.add(businessId);

    setContactsMap((prev) => ({ ...prev, [businessId]: { status: 'loading' } }));

    try {
      const qs = new URLSearchParams({ website });
      const res = await fetch(`/api/scrape-contacts?${qs}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);

      setContactsMap((prev) => ({
        ...prev,
        [businessId]: { status: 'success', data: { emails: data.emails ?? [], phones: [] } },
      }));
    } catch (err) {
      initiated.current.delete(businessId);
      setContactsMap((prev) => ({
        ...prev,
        [businessId]: { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' },
      }));
    }
  }, []);

  return { contactsMap, scrape };
}
