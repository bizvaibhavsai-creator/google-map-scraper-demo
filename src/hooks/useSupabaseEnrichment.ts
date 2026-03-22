'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ContactsState } from '@/types';

export function useSupabaseEnrichment() {
  const [contactsMap, setContactsMap] = useState<Record<string, ContactsState>>({});
  const enrichingRef = useRef(false);
  const abortRef = useRef(false);

  // Subscribe to real-time updates on the businesses table
  useEffect(() => {
    const channel = supabase
      .channel('businesses-emails')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'businesses' },
        (payload) => {
          const row = payload.new as { business_id: string; emails: string[]; enrichment_status: string };
          if (row.enrichment_status === 'done') {
            setContactsMap((prev) => ({
              ...prev,
              [row.business_id]: {
                status: 'success',
                data: { emails: row.emails ?? [], phones: [] },
              },
            }));
          } else if (row.enrichment_status === 'error') {
            setContactsMap((prev) => ({
              ...prev,
              [row.business_id]: { status: 'error', message: 'Enrichment failed' },
            }));
          } else if (row.enrichment_status === 'processing') {
            setContactsMap((prev) => ({
              ...prev,
              [row.business_id]: prev[row.business_id] ?? { status: 'loading' },
            }));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Insert results into Supabase and start enrichment loop
  const insertAndEnrich = useCallback(async (results: { business_id: string; website: string | null }[]) => {
    abortRef.current = false;

    // Mark all with websites as loading
    const initial: Record<string, ContactsState> = {};
    results.forEach((r) => {
      if (r.website) {
        initial[r.business_id] = { status: 'loading' };
      }
    });
    setContactsMap(initial);

    // Insert into Supabase
    try {
      await fetch('/api/supabase-insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      });
    } catch (err) {
      console.error('Failed to insert into Supabase:', err);
      return;
    }

    // Start enrichment loop — keep calling /api/enrich-emails until no pending rows remain
    if (enrichingRef.current) return;
    enrichingRef.current = true;

    try {
      let remaining = 1; // start the loop
      while (remaining > 0 && !abortRef.current) {
        const res = await fetch('/api/enrich-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        remaining = data.remaining ?? 0;

        // Small delay to avoid hammering
        if (remaining > 0) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    } catch (err) {
      console.error('Enrichment loop error:', err);
    } finally {
      enrichingRef.current = false;
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { contactsMap, insertAndEnrich, cancel };
}
