import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateContentOutline } from '@/lib/seo-content-studio/outline-generator';
import { ContentBrief } from '@/lib/seo-content-studio/types';

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
    const brief: ContentBrief = body.brief;

    if (!brief || !brief.topic) {
      return NextResponse.json({ error: 'Valid content brief is required to generate outline.' }, { status: 400 });
    }

    const outline = generateContentOutline(brief);

    // Update brief in database if ID is provided
    if (brief.id) {
      await supabase
        .from('content_briefs')
        .update({ outline_data: outline, updated_at: new Date().toISOString() })
        .eq('id', brief.id)
        .eq('user_id', user.id);
    }

    return NextResponse.json({
      success: true,
      outline,
    });
  } catch (err: any) {
    console.error('POST Content Studio Outline Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to generate content outline.' }, { status: 500 });
  }
}
