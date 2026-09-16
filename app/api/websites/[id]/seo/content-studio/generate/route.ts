import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateContentStudioArticle } from '@/lib/seo-content-studio/content-generator';

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
    const brief = body.brief;
    const outline = body.outline;

    if (!brief || !brief.topic) {
      return NextResponse.json({ error: 'Valid content brief is required.' }, { status: 400 });
    }

    const draft = await generateContentStudioArticle(supabase, websiteId, user.id, brief, outline);

    return NextResponse.json({
      success: true,
      draft,
    });
  } catch (err: any) {
    console.error('POST Content Studio Generate Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to generate AI content draft.' },
      { status: err?.message?.includes('credits') ? 402 : 500 }
    );
  }
}
