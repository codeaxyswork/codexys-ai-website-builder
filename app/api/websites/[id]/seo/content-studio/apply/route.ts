import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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
    const {
      target_id,
      target_type = 'blog',
      confirm_apply,
      title,
      content,
      excerpt,
      category,
      tags,
      seo_title,
      meta_description,
      focus_keyword,
      canonical_url,
      og_title,
      og_description,
      og_image,
      change_summary,
      status,
    } = body;

    // Explicit approval requirement
    if (confirm_apply !== true) {
      return NextResponse.json(
        { error: 'Explicit user approval (confirm_apply: true) is required to apply content changes.' },
        { status: 400 }
      );
    }

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and Content are required to apply changes.' }, { status: 400 });
    }

    let updatedRecord: any = null;

    if (target_type === 'blog') {
      // If target_id exists, update existing post; else insert new post
      if (target_id) {
        // Fetch current version for revision history
        const { data: currentPost } = await supabase
          .from('blog_posts')
          .select('*')
          .eq('id', target_id)
          .eq('website_id', websiteId)
          .single();

        if (currentPost) {
          // Count revisions for version number
          const { count } = await supabase
            .from('content_revisions')
            .select('id', { count: 'exact', head: true })
            .eq('target_id', target_id);

          const versionNum = (count || 0) + 1;

          // Save current state into content_revisions before updating
          await supabase.from('content_revisions').insert({
            website_id: websiteId,
            user_id: user.id,
            target_id: target_id,
            target_type: 'blog',
            version_number: versionNum,
            title: currentPost.title,
            content: currentPost.content,
            seo_metadata: {
              seo_title: currentPost.seo_title,
              meta_description: currentPost.meta_description,
              focus_keyword: currentPost.focus_keyword,
            },
            change_summary: change_summary || `Updated via Content Studio (v${versionNum})`,
          });
        }

        const { data: updated, error } = await supabase
          .from('blog_posts')
          .update({
            title,
            content,
            excerpt: excerpt || '',
            category: category || 'General',
            tags: Array.isArray(tags) ? tags : ['Blog'],
            seo_title: seo_title || title,
            meta_description: meta_description || excerpt || '',
            focus_keyword: focus_keyword || '',
            canonical_url: canonical_url || null,
            og_title: og_title || seo_title || title,
            og_description: og_description || meta_description || '',
            og_image: og_image || null,
            status: status || currentPost?.status || 'draft',
            updated_at: new Date().toISOString(),
          })
          .eq('id', target_id)
          .eq('website_id', websiteId)
          .select()
          .single();

        if (error) throw error;
        updatedRecord = updated;
      } else {
        // Create new blog post
        const slug = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

        const { data: created, error } = await supabase
          .from('blog_posts')
          .insert({
            website_id: websiteId,
            user_id: user.id,
            title,
            slug,
            content,
            excerpt: excerpt || '',
            category: category || 'General',
            tags: Array.isArray(tags) ? tags : ['Blog'],
            seo_title: seo_title || title,
            meta_description: meta_description || excerpt || '',
            focus_keyword: focus_keyword || '',
            status: status || 'draft',
          })
          .select()
          .single();

        if (error) throw error;
        updatedRecord = created;
      }
    } else {
      // Website page update
      if (target_id) {
        const { data: page, error } = await supabase
          .from('website_pages')
          .update({
            seo_title: seo_title || title,
            meta_description: meta_description || excerpt || '',
            keywords: focus_keyword ? [focus_keyword] : [],
            updated_at: new Date().toISOString(),
          })
          .eq('id', target_id)
          .eq('website_id', websiteId)
          .select()
          .single();

        if (error) throw error;
        updatedRecord = page;
      }
    }

    return NextResponse.json({
      success: true,
      applied: updatedRecord,
      message: 'Content changes successfully applied with explicit user approval.',
    });
  } catch (err: any) {
    console.error('POST Content Studio Apply Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to apply content changes.' }, { status: 500 });
  }
}
