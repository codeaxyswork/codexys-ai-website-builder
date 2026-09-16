import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateContentBrief } from '@/lib/seo-content-studio/brief-generator';

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
    const topic = (body.topic || '').trim();

    if (!topic) {
      return NextResponse.json({ error: 'Topic is required to generate content brief.' }, { status: 400 });
    }

    const brief = await generateContentBrief(supabase, websiteId, user.id, {
      topic,
      primary_keyword: body.primary_keyword,
      secondary_keywords: body.secondary_keywords,
      search_intent: body.search_intent,
      target_audience: body.target_audience,
      content_type: body.content_type,
      desired_tone: body.desired_tone,
      opportunity_id: body.opportunity_id,
      competitor_domain: body.competitor_domain,
    });

    // Save to database
    const { data: savedBrief } = await supabase
      .from('content_briefs')
      .insert({
        website_id: websiteId,
        user_id: user.id,
        topic: brief.topic,
        primary_keyword: brief.primary_keyword,
        secondary_keywords: brief.secondary_keywords,
        search_intent: brief.search_intent,
        target_audience: brief.target_audience,
        content_type: brief.content_type,
        topic_cluster: brief.topic_cluster,
        desired_tone: brief.desired_tone,
        opportunity_id: brief.opportunity_id,
        competitor_gap_context: brief.competitor_gap_context || {},
        gsc_context: brief.gsc_context || {},
        brief_data: brief,
      })
      .select('id, created_at')
      .single();

    return NextResponse.json({
      success: true,
      brief: {
        ...brief,
        id: savedBrief?.id,
      },
    });
  } catch (err: any) {
    console.error('POST Content Studio Brief Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to generate content brief.' }, { status: 500 });
  }
}
