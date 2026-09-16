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

    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity');
    const category = searchParams.get('category');
    const crawlId = searchParams.get('crawl_id');

    let query = supabase
      .from('technical_crawl_issues')
      .select('*')
      .eq('website_id', websiteId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (crawlId) query = query.eq('crawl_id', crawlId);
    if (severity && severity !== 'all') query = query.eq('severity', severity);
    if (category && category !== 'all') query = query.eq('category', category);

    const { data: issues, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      issues: issues || [],
    });
  } catch (err: any) {
    console.error('GET Technical Issues Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch technical issues.' }, { status: 500 });
  }
}
