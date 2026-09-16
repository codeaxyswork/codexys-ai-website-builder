import { calculateAnswerReadinessScore, calculateTopicCoverageScore } from '../lib/seo-aeo/scorer';
import { runAEOAnalysis } from '../lib/seo-aeo/engine';
import { runTopicalAuthorityAnalysis } from '../lib/seo-aeo/topical-authority';

async function runPhase12Tests() {
  console.log('=== RUNNING PHASE 12 AEO & TOPICAL AUTHORITY VERIFICATION ===');

  // Test 1: Answer Readiness Scorer
  console.log('\n--- Test 1: Answer Readiness Scorer ---');
  const readinessResult = calculateAnswerReadinessScore({
    answerClarity: 18,
    questionCoverage: 12,
    contentStructure: 14,
    entityUnderstanding: 12,
    semanticRelevance: 14,
    structuredData: 10,
    topicDepth: 8,
  });

  console.log(`Answer Readiness Score: ${readinessResult.totalScore}/100 (Level: ${readinessResult.level})`);
  if (readinessResult.totalScore < 85 || readinessResult.level !== 'Optimal') {
    throw new Error(`Expected Optimal level, got ${readinessResult.level} (${readinessResult.totalScore})`);
  }

  // Test 2: Topic Coverage Scorer
  console.log('\n--- Test 2: Topic Coverage Scorer ---');
  const coverageResult = calculateTopicCoverageScore([
    {
      id: 'c1',
      mainTopic: 'Luxury Automobiles',
      supportingTopics: ['Ferrari', 'Lamborghini', 'McLaren'],
      subtopics: ['Buying Guide', 'Maintenance', 'Financing'],
      relatedPages: ['/cars'],
      relatedBlogPosts: ['/blog/ferrari-guide'],
      clusterCoverageScore: 85,
      readinessScore: 80,
      missingSubtopics: ['Luxury Car Insurance'],
    },
  ]);

  console.log(`Topic Coverage Score: ${coverageResult.totalScore}/100 (Level: ${coverageResult.level})`);
  if (coverageResult.totalScore < 60) {
    throw new Error(`Expected Good/Comprehensive coverage, got score ${coverageResult.totalScore}`);
  }

  // Test 3: AEO Engine Scanning & Mock Persistence
  console.log('\n--- Test 3: AEO Engine Scanning & Opportunity Integration ---');
  const mockWebsites = [{ id: 'site_456', title: 'Codeaxys Enterprise Web Solutions', published_slug: 'codeaxys' }];
  const mockWebsiteSeo = [{ website_id: 'site_456', seo_title: 'Codeaxys Solutions', meta_description: 'AI Website builder', focus_keywords: 'AI Website, SEO Engine', schema_markup: null }];
  const mockPages = [
    { id: 'p1', website_id: 'site_456', path: '/', html_content: '<h1>Welcome to Codeaxys</h1><h2>What is Codeaxys AI Website Builder?</h2><p>Codeaxys is an AI-powered web creation engine.</p>' },
  ];
  const mockBlogPosts = [
    { id: 'b1', website_id: 'site_456', title: 'How to Optimize Website SEO', slug: 'how-to-optimize-seo', category: 'SEO', status: 'published', content: '<h2>How to optimize your site SEO?</h2><p>Follow these 5 steps...</p>' },
  ];
  const mockLocalSeo = [{ website_id: 'site_456', business_name: 'Codeaxys Inc', city: 'San Francisco', phone: '123-456-7890' }];
  const mockOpportunities: any[] = [];

  const mockSupabase: any = {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: any) => ({
          single: async () => {
            if (table === 'websites') return { data: mockWebsites.find((w) => w.id === val) };
            return { data: null };
          },
          maybeSingle: async () => {
            if (table === 'website_seo') return { data: mockWebsiteSeo.find((s) => s.website_id === val) };
            if (table === 'website_local_seo') return { data: mockLocalSeo.find((s) => s.website_id === val) };
            return { data: null };
          },
          limit: () => ({
            then: (cb: any) => cb({ data: [] }),
          }),
          then: (cb: any) => {
            if (table === 'website_pages') return cb({ data: mockPages.filter((p) => p.website_id === val) });
            if (table === 'blog_posts') return cb({ data: mockBlogPosts.filter((b) => b.website_id === val) });
            if (table === 'gsc_search_analytics') return cb({ data: [] });
            return cb({ data: [] });
          },
        }),
      }),
      upsert: (row: any) => {
        if (table === 'seo_opportunities') {
          mockOpportunities.push(row);
        }
        return Promise.resolve({ error: null });
      },
    }),
  };

  const aeoAnalysis = await runAEOAnalysis(mockSupabase, 'site_456', 'user_456');
  console.log(`AEO Scan Complete. Score: ${aeoAnalysis.answer_readiness_score}/100. Discovered ${aeoAnalysis.questions_discovered.length} question(s).`);

  if (aeoAnalysis.questions_discovered.length === 0) {
    throw new Error('Expected engine to discover question headings from page & blog HTML');
  }

  // Test 4: Topical Authority Engine
  console.log('\n--- Test 4: Topical Authority Engine ---');
  const topicalAnalysis = await runTopicalAuthorityAnalysis(mockSupabase, 'site_456', 'user_456');
  console.log(`Topical Authority Score: ${topicalAnalysis.topic_coverage_score}/100. Clusters: ${topicalAnalysis.topic_clusters.length}. Gaps: ${topicalAnalysis.content_gaps.length}`);
  console.log(`Registered Opportunities in seo_opportunities: ${mockOpportunities.length}`);

  if (topicalAnalysis.topic_clusters.length === 0) {
    throw new Error('Expected topical authority engine to build topic clusters');
  }

  console.log('\n✅ ALL PHASE 12 AEO & TOPICAL AUTHORITY VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runPhase12Tests().catch((err) => {
  console.error('\n❌ Phase 12 Verification Failed:', err);
  process.exit(1);
});
