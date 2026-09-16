import { analyzeContentQuality } from './quality-analyzer';
import { ContentRefreshReport, ContentRefreshRecommendation } from './types';

export async function analyzeContentRefresh(
  supabase: any,
  websiteId: string,
  userId: string,
  targetId: string,
  targetType: 'blog' | 'page' = 'blog'
): Promise<ContentRefreshReport> {
  let title = 'Untitled Item';
  let content = '';
  let seoTitle = '';
  let metaDesc = '';
  let focusKw = '';
  let updatedAtStr = new Date().toISOString();

  if (targetType === 'blog') {
    const { data: post, error } = await supabase
      .from('blog_posts')
      .select('id, title, content, seo_title, meta_description, focus_keyword, updated_at, created_at')
      .eq('id', targetId)
      .eq('website_id', websiteId)
      .single();

    if (error || !post) {
      throw new Error(`Blog post with ID ${targetId} not found.`);
    }

    title = post.title || 'Untitled Blog Post';
    content = post.content || '';
    seoTitle = post.seo_title || title;
    metaDesc = post.meta_description || '';
    focusKw = post.focus_keyword || '';
    updatedAtStr = post.updated_at || post.created_at || updatedAtStr;
  } else {
    const { data: page, error } = await supabase
      .from('website_pages')
      .select('id, path, seo_title, meta_description, keywords, content, updated_at, created_at')
      .eq('id', targetId)
      .eq('website_id', websiteId)
      .single();

    if (error || !page) {
      throw new Error(`Website page with ID ${targetId} not found.`);
    }

    title = page.seo_title || page.path || 'Page';
    content = typeof page.content === 'string' ? page.content : JSON.stringify(page.content || {});
    seoTitle = page.seo_title || title;
    metaDesc = page.meta_description || '';
    focusKw = Array.isArray(page.keywords) ? page.keywords[0] : '';
    updatedAtStr = page.updated_at || page.created_at || updatedAtStr;
  }

  // 1. Quality Analysis
  const quality = analyzeContentQuality(content, title, {
    seo_title: seoTitle,
    meta_description: metaDesc,
    focus_keyword: focusKw,
  });

  // 2. Freshness Check
  const ageInDays = Math.floor((Date.now() - new Date(updatedAtStr).getTime()) / (1000 * 60 * 60 * 24));
  let freshness: ContentRefreshReport['metadata_freshness'] = 'fresh';
  if (ageInDays > 180) freshness = 'outdated';
  else if (ageInDays > 90) freshness = 'needs_update';

  // 3. Generate Actionable Recommendations
  const recommendations: ContentRefreshRecommendation[] = [];

  if (freshness !== 'fresh') {
    recommendations.push({
      id: 'freshness_update',
      category: 'freshness',
      severity: freshness === 'outdated' ? 'high' : 'medium',
      what: `Content has not been updated in ${ageInDays} days.`,
      why: 'Search engines reward content freshness and up-to-date information.',
      where: 'Entire article body & publication date',
      suggested_action: 'Refresh statistics, add recent industry developments, and update metadata.',
    });
  }

  if (quality.breakdown.aeo_readiness_score < 70) {
    recommendations.push({
      id: 'aeo_direct_answer',
      category: 'aeo',
      severity: 'high',
      what: 'Weak direct answer / AEO readiness structure.',
      why: 'AI search engines (Perplexity, Gemini, ChatGPT) favor answer-first introductions and explicit question headers.',
      where: 'Introduction paragraph and H2 headers',
      suggested_action: 'Add a 2-sentence direct answer definition block right below the H1 heading.',
    });
  }

  if (quality.breakdown.question_coverage_score < 60) {
    recommendations.push({
      id: 'add_faq_section',
      category: 'aeo',
      severity: 'medium',
      what: 'Missing structured FAQ section.',
      why: 'FAQ sections capture long-tail query volume and featured snippets.',
      where: 'Bottom of the article before Conclusion',
      suggested_action: 'Add an H2 "Frequently Asked Questions" section with 3 Q&A pairs.',
    });
  }

  if (quality.breakdown.internal_link_score < 60) {
    recommendations.push({
      id: 'add_internal_links',
      category: 'internal_links',
      severity: 'medium',
      what: 'Insufficient internal contextual links.',
      why: 'Internal links distribute page authority and help Google discover related topic clusters.',
      where: 'Body paragraphs (H2 sections)',
      suggested_action: 'Insert 2 to 3 contextual internal links pointing to relevant service or blog pages.',
    });
  }

  if (!metaDesc || metaDesc.length < 100) {
    recommendations.push({
      id: 'improve_meta_desc',
      category: 'metadata',
      severity: 'critical',
      what: 'Meta description is missing or too short.',
      why: 'Meta descriptions directly impact CTR on search engine results pages.',
      where: 'SEO Meta Description tag',
      suggested_action: 'Write a compelling 140-160 character meta description containing the target keyword.',
    });
  }

  return {
    target_id: targetId,
    target_type: targetType,
    title,
    quality_score: quality.overall_score,
    metadata_freshness: freshness,
    topic_coverage_score: quality.breakdown.topic_coverage_score,
    aeo_readiness_score: quality.breakdown.aeo_readiness_score,
    recommendations,
    analysis_timestamp: new Date().toISOString(),
  };
}
