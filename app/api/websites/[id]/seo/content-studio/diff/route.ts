import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { computeBeforeAfterDiff } from '@/lib/seo-content-studio/diff-engine';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const original = body.original;
    const proposed = body.proposed;

    if (!original || !proposed) {
      return NextResponse.json({ error: 'Both original and proposed payloads are required for diff.' }, { status: 400 });
    }

    const diff = computeBeforeAfterDiff(original, proposed);

    return NextResponse.json({
      success: true,
      diff,
    });
  } catch (err: any) {
    console.error('POST Content Diff Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to compute content diff.' }, { status: 500 });
  }
}
