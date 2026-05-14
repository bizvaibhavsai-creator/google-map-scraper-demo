import { NextRequest, NextResponse } from 'next/server';
import { clampLimit, fetchSearchBatch } from '@/lib/scraper';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: {
    pairs: Array<{ keyword: string; location: string }>;
    limit?: string;
    country?: string;
    lang?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.pairs) || body.pairs.length === 0) {
    return NextResponse.json({ error: 'pairs array is required' }, { status: 400 });
  }

  try {
    const response = await fetchSearchBatch(
      body.pairs,
      clampLimit(body.limit),
      body.country || 'us',
      body.lang || 'en',
    );
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
