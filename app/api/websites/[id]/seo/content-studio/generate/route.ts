import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateContentStudioArticle } from '@/lib/seo-content-studio/content-generator';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    // 1. Authenticate User
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate Limiting (10 requests per minute per user)
    const rl = checkRateLimit(`content_studio_${user.id}`, { limit: 10, windowMs: 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many content generation requests. Please slow down.' },
        { status: 429 }
      );
    }

    // 2. Verify Website Ownership
    const { data: website, error: webErr } = await supabase
      .from('websites')
      .select('id, user_id')
      .eq('id', websiteId)
      .eq('user_id', user.id)
      .single();

    if (webErr || !website) {
      return NextResponse.json(
        { error: 'Website not found or access denied.' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const brief = body.brief;
    const outline = body.outline;

    if (!brief || !brief.topic) {
      return NextResponse.json({ error: 'Valid content brief is required.' }, { status: 400 });
    }

    const opId =
      request.headers.get("x-request-id") ||
      request.headers.get("idempotency-key") ||
      body?.requestId ||
      crypto.randomUUID();

    const draft = await generateContentStudioArticle(supabase, websiteId, user.id, brief, outline, opId);

    return NextResponse.json({
      success: true,
      draft,
    });
  } catch (err: any) {
    console.error('POST Content Studio Generate Error:', err);
    const isCreditError = err?.message?.toLowerCase().includes('credits');
    return NextResponse.json(
      {
        error: err?.message || 'Failed to generate AI content draft.',
        code: isCreditError ? 'INSUFFICIENT_CREDITS' : 'GENERATION_ERROR',
      },
      { status: isCreditError ? 402 : 500 }
    );
  }
}
