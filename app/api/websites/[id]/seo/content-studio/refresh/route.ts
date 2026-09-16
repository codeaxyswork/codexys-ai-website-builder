import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { analyzeContentRefresh } from '@/lib/seo-content-studio/refresh-engine';

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
    const targetId = body.target_id;
    const targetType = body.target_type || 'blog';

    if (!targetId) {
      return NextResponse.json({ error: 'target_id is required for Content Refresh.' }, { status: 400 });
    }

    const report = await analyzeContentRefresh(supabase, websiteId, user.id, targetId, targetType);

    // Save refresh run
    await supabase.from('content_refresh_runs').insert({
      website_id: websiteId,
      user_id: user.id,
      target_id: targetId,
      target_type: targetType,
      quality_score: report.quality_score,
      analysis_result: report,
      recommendations: report.recommendations,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err: any) {
    console.error('POST Content Refresh Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to analyze content for refresh.' }, { status: 500 });
  }
}
