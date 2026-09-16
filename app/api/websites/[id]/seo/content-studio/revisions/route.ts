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
    const targetId = searchParams.get('target_id');

    let query = supabase
      .from('content_revisions')
      .select('*')
      .eq('website_id', websiteId)
      .eq('user_id', user.id)
      .order('version_number', { ascending: false });

    if (targetId) {
      query = query.eq('target_id', targetId);
    }

    const { data: revisions, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      revisions: revisions || [],
    });
  } catch (err: any) {
    console.error('GET Content Revisions Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch content revisions.' }, { status: 500 });
  }
}
