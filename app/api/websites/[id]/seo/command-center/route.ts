import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { aggregateCommandCenterData } from '@/lib/seo-command-center/aggregator';
import { getCache, setCache, CACHE_KEYS, CACHE_TTLS, getCacheHeader } from '@/lib/cache';

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

    // Check Redis Cache
    const cacheKey = CACHE_KEYS.commandCenter(websiteId);
    const { data: cachedPayload, status } = await getCache<any>(cacheKey);

    if (cachedPayload) {
      return NextResponse.json(
        { success: true, commandCenter: cachedPayload },
        { headers: getCacheHeader("HIT") }
      );
    }

    const payload = await aggregateCommandCenterData(supabase, websiteId, user.id);

    // Store in Redis cache
    await setCache(cacheKey, payload, CACHE_TTLS.COMMAND_CENTER);

    return NextResponse.json(
      { success: true, commandCenter: payload },
      { headers: getCacheHeader(status === "BYPASS" ? "BYPASS" : "MISS") }
    );
  } catch (err: any) {
    console.error('GET SEO Command Center Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to load SEO Command Center payload.' }, { status: 500 });
  }
}
