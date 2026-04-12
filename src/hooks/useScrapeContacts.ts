'use client';

import { useState, useCallback } from 'react';
import type { ContactsState } from '@/types';

const CONCURRENCY = 4;

export function useScrapeContacts() {
  const [contactsMap, setContactsMap] = useState<Record<string, ContactsState>>({});

  const scrape = useCallback(
    (items: Array<{ businessId: string; website: string }>) => {
      if (items.length === 0) return;

      setContactsMap((prev) => {
        const next = { ...prev };
        items.forEach((item) => {
          next[item.businessId] = {
            status: 'error',
            message: 'Email enrichment is temporarily disabled.',
          };
        });
        return next;
      });
    },
    [],
  );

  return { contactsMap, scrape };
}
