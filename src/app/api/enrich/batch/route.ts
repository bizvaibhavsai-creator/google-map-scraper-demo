import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: {
    items: Array<{ businessId: string; website: string }>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'items array is required' }, { status: 400 });
  }

  return NextResponse.json(
    { error: 'Email enrichment is temporarily disabled.' },
    { status: 503 },
  );
}
