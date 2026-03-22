import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const { results } = await request.json();

  if (!Array.isArray(results) || results.length === 0) {
    return NextResponse.json({ error: 'results array is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Map results to DB rows
  const rows = results.map((r: Record<string, unknown>) => ({
    business_id: r.business_id,
    name: r.name,
    types: Array.isArray(r.types) ? r.types.join(', ') : (r.types || null),
    is_permanently_closed: Boolean(r.is_permanently_closed),
    is_temporarily_closed: Boolean(r.is_temporarily_closed),
    keyword: r._keyword || null,
    location: r._location || null,
    full_address: r.full_address || null,
    phone_number: r.phone_number || null,
    rating: r.rating ?? null,
    review_count: r.review_count ?? null,
    website: r.website || null,
    place_id: r.place_id || null,
    emails: [],
    enrichment_status: r.website ? 'pending' : 'skipped',
  }));

  // Upsert to handle duplicate business_ids
  const { error } = await supabase
    .from('businesses')
    .upsert(rows, { onConflict: 'business_id', ignoreDuplicates: false });

  if (error) {
    console.error('[supabase-insert] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: rows.length });
}
