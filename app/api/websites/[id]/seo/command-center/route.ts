import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { aggregateCommandCenterData } from '@/lib/seo-command-center/aggregator';

export async function GET(
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

    // Verify ownership
    const { data: website, error: webErr } = await supabase
      .from('websites')
      .select('id, title')
      .eq('id', websiteId)
      .eq('user_id', user.id)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: 'Website not found or access denied.' }, { status: 404 });
    }

    const payload = await aggregateCommandCenterData(supabase, websiteId, user.id);

    return NextResponse.json({
      success: true,
      commandCenter: payload,
    });
  } catch (err: any) {
    console.error('GET SEO Command Center Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to load SEO Command Center payload.' }, { status: 500 });
  }
}
