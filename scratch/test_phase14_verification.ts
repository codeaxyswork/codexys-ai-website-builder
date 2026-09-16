import { generateContentBrief } from '../lib/seo-content-studio/brief-generator';
import { generateContentOutline } from '../lib/seo-content-studio/outline-generator';
import { analyzeContentQuality } from '../lib/seo-content-studio/quality-analyzer';
import { analyzeContentRefresh } from '../lib/seo-content-studio/refresh-engine';
import { computeBeforeAfterDiff } from '../lib/seo-content-studio/diff-engine';

async function runPhase14Tests() {
  console.log('=== RUNNING PHASE 14 SEO CONTENT STUDIO & CONTENT REFRESH VERIFICATION ===');

  // Test 1: Content Brief Generation with Mock Supabase Context
  console.log('\n--- Test 1: Content Brief Generation ---');
  const mockWebsites = [{ id: 'site_100', title: 'Codeaxys Enterprise Systems', prompt: 'Enterprise AI & Web Apps' }];
  const mockBlogPosts: any[] = [];
  const mockCompetitorAnalyses = [
    { content_gaps: [{ topic: 'Enterprise Cloud Security' }], competitor_id: 'comp_1' }
  ];

  const createQueryChain = (table: string, idVal: string) => {
    const chain: any = {
      eq: () => chain,
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      single: async () => {
        if (table === 'websites') return { data: mockWebsites.find((w) => w.id === idVal) };
        if (table === 'blog_posts') return { data: mockBlogPosts.find((b) => b.id === idVal) };
        return { data: null };
      },
      maybeSingle: async () => {
        if (table === 'website_aeo_analysis') {
          return { data: { topic_clusters: [{ core_topic: 'Enterprise Solutions' }] } };
        }
        return { data: null };
      },
      then: (cb: any) => {
        if (table === 'competitor_analyses') return cb({ data: mockCompetitorAnalyses });
        if (table === 'gsc_search_analytics') return cb({ data: [{ query: 'enterprise website development', impressions: 500, clicks: 30 }] });
        if (table === 'website_pages') return cb({ data: [{ path: '/services', seo_title: 'Our Services' }] });
        if (table === 'blog_posts') return cb({ data: mockBlogPosts });
        return cb({ data: [] });
      },
    };
    return chain;
  };

  const mockSupabase: any = {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: any) => createQueryChain(table, val),
      }),
    }),
  };

  const brief = await generateContentBrief(mockSupabase, 'site_100', 'user_100', {
    topic: 'Enterprise Cloud Security Best Practices',
    primary_keyword: 'enterprise cloud security',
    secondary_keywords: ['data encryption', 'identity management'],
  });

  console.log(`Generated Brief Topic: "${brief.topic}"`);
  console.log(`Primary Keyword: "${brief.primary_keyword}"`);
  console.log(`Source Recommendations count: ${brief.source_recommendations.length}`);
  if (!brief.topic || brief.source_recommendations.length === 0) {
    throw new Error('Content Brief generation failed');
  }

  // Test 2: Content Outline Generation
  console.log('\n--- Test 2: Content Outline Generation ---');
  const outline = generateContentOutline(brief);
  console.log(`Generated Outline H1: "${outline.h1}"`);
  console.log(`Outline Sections count: ${outline.sections.length}`);
  console.log(`AEO Direct Answer Target: "${outline.aeo_direct_answer_target}"`);
  if (!outline.h1 || outline.sections.length < 3) {
    throw new Error('Content Outline generation failed');
  }

  // Test 3: Deterministic Quality Analysis (0 AI Credit)
  console.log('\n--- Test 3: Deterministic Quality Analysis ---');
  const sampleArticleHtml = `
    <h1>Enterprise Cloud Security Guide</h1>
    <p>Enterprise cloud security is the discipline of safeguarding cloud environments from unauthorized access and data breaches.</p>
    <h2>Core Components of Cloud Security</h2>
    <p>Data encryption, zero-trust architecture, and strict access controls are foundational for modern organizations.</p>
    <h2>Frequently Asked Questions</h2>
    <p>How do I start with cloud security?</p>
    <a href="/services">Learn more about our Enterprise Services</a>
  `;

  const quality = analyzeContentQuality(sampleArticleHtml, 'Enterprise Cloud Security Guide', {
    seo_title: 'Enterprise Cloud Security Guide | Codeaxys',
    meta_description: 'Discover key enterprise cloud security best practices, zero trust architecture, and data protection strategies.',
    focus_keyword: 'enterprise cloud security',
  });

  console.log(`Overall Quality Score: ${quality.overall_score}/100`);
  console.log(`AEO Readiness Score: ${quality.breakdown.aeo_readiness_score}%`);
  console.log(`Readability Score: ${quality.breakdown.readability_score}%`);
  if (quality.overall_score <= 0 || quality.breakdown.heading_structure_score === 0) {
    throw new Error('Quality analysis failed');
  }

  // Test 4: Content Refresh Analysis
  console.log('\n--- Test 4: Content Refresh Audit ---');
  mockBlogPosts.push({
    id: 'post_1',
    website_id: 'site_100',
    title: 'Outdated Cloud Security Post',
    content: '<p>Old content without headings or questions.</p>',
    seo_title: 'Old Title',
    meta_description: '',
    updated_at: '2025-01-01T00:00:00Z',
  });

  const refreshReport = await analyzeContentRefresh(mockSupabase, 'site_100', 'user_100', 'post_1', 'blog');
  console.log(`Refresh Report Freshness: ${refreshReport.metadata_freshness}`);
  console.log(`Recommendations Count: ${refreshReport.recommendations.length}`);
  if (refreshReport.recommendations.length === 0) {
    throw new Error('Content refresh audit failed to produce recommendations');
  }

  // Test 5: Before vs After Content Diff
  console.log('\n--- Test 5: Before vs After Content Diff ---');
  const original = { title: 'Old Title', content: '<p>Old text</p>' };
  const proposed = { title: 'New Title', content: '<h2>New H2</h2><p>New text</p>' };
  const diff = computeBeforeAfterDiff(original, proposed);

  console.log(`Diff Added Sections: ${diff.added_lines_count}`);
  console.log(`Metadata Changed: ${diff.metadata_changed}`);
  if (diff.added_lines_count === 0 || !diff.metadata_changed) {
    throw new Error('Before/After diff computation failed');
  }

  console.log('\n✅ ALL PHASE 14 SEO CONTENT STUDIO & CONTENT REFRESH VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runPhase14Tests().catch((err) => {
  console.error('\n❌ Phase 14 Verification Failed:', err);
  process.exit(1);
});
