import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { analyzeContentQuality } from '@/lib/seo-content-studio/quality-analyzer';

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
    const content = body.content || '';
    const title = body.title || 'Untitled';
    const seoMetadata = body.seo_metadata;

    const analysis = analyzeContentQuality(content, title, seoMetadata);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (err: any) {
    console.error('POST Content Studio Analyze Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to analyze content quality.' }, { status: 500 });
  }
}
