import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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

    const { data: runs, error } = await supabase
      .from('technical_crawl_runs')
      .select('id, technical_score, total_urls_crawled, total_issues_count, summary_breakdown, crawl_duration_ms, created_at')
      .eq('website_id', websiteId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      runs: runs || [],
    });
  } catch (err: any) {
    console.error('GET Technical Runs Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch crawl runs.' }, { status: 500 });
  }
}
