import { normalizeCompetitorDomain, isValidDomain } from '../lib/seo-competitors/crawler';
import { runCompetitorGapAnalysis } from '../lib/seo-competitors/gap-engine';

async function runPhase13Tests() {
  console.log('=== RUNNING PHASE 13 COMPETITOR & CONTENT GAP VERIFICATION ===');

  // Test 1: Domain Normalization & Validation
  console.log('\n--- Test 1: Domain Validation & Normalization ---');
  const d1 = normalizeCompetitorDomain('https://www.competitor-site.com/services?ref=123');
  console.log(`Normalized URL: "https://www.competitor-site.com/services?ref=123" -> "${d1}"`);
  if (d1 !== 'competitor-site.com' || !isValidDomain(d1)) {
    throw new Error(`Domain normalization failed for d1: ${d1}`);
  }

  const invalid = isValidDomain('not_a_valid_domain_string');
  console.log(`Validation for "not_a_valid_domain_string": ${invalid}`);
  if (invalid) {
    throw new Error('Expected invalid domain check to fail for invalid string');
  }

  // Test 2: Gap Engine & Mock Supabase Persistence
  console.log('\n--- Test 2: Content Gap Engine & Mock Persistence ---');
  const mockWebsites = [{ id: 'site_789', title: 'Codeaxys Enterprise Web Solutions' }];
  const mockCustomerPages = [{ website_id: 'site_789', path: '/', seo_title: 'Home Page' }];
  const mockCustomerBlog: any[] = [];
  const mockOpportunities: any[] = [];
  const mockCompetitors = [{ id: 'comp_1', website_id: 'site_789', domain: 'acme-corp.com', status: 'active' }];
  const mockCompetitorAnalyses: any[] = [];

  const createQueryChain = (table: string, siteIdVal: string) => {
    const chain: any = {
      eq: () => chain,
      single: async () => {
        if (table === 'websites') return { data: mockWebsites.find((w) => w.id === siteIdVal) };
        if (table === 'seo_competitors') return { data: mockCompetitors.find((c) => c.id === siteIdVal) };
        return { data: null };
      },
      maybeSingle: async () => {
        if (table === 'website_aeo_analysis') return { data: null };
        return { data: null };
      },
      limit: () => chain,
      then: (cb: any) => {
        if (table === 'website_third_party_seo_integrations') return cb({ data: [] });
        if (table === 'website_pages') return cb({ data: mockCustomerPages });
        if (table === 'blog_posts') return cb({ data: mockCustomerBlog });
        if (table === 'gsc_search_analytics') return cb({ data: [] });
        return cb({ data: [] });
      },
    };
    return chain;
  };

  const mockSupabase: any = {
    from: (table: string) => ({
      select: (cols?: string) => ({
        eq: (col: string, val: any) => createQueryChain(table, val),
      }),
      insert: (row: any) => ({
        select: () => ({
          single: async () => {
            const inserted = { id: `id_${Date.now()}`, ...row };
            if (table === 'competitor_analyses') mockCompetitorAnalyses.push(inserted);
            return { data: inserted };
          },
        }),
      }),
      update: (row: any) => ({
        eq: (col: string, val: any) => {
          const comp = mockCompetitors.find((c) => c.id === val);
          if (comp) Object.assign(comp, row);
          return Promise.resolve({ error: null });
        },
      }),
      upsert: (row: any) => {
        if (table === 'seo_opportunities') {
          mockOpportunities.push(row);
        }
        return Promise.resolve({ error: null });
      },
    }),
  };

  const analysis = await runCompetitorGapAnalysis(mockSupabase, 'site_789', 'user_789', 'comp_1', 'acme-corp.com');
  console.log(`Gap Analysis Completed for acme-corp.com.`);
  console.log(`Discovered Gaps count: ${analysis.content_gaps.length}`);
  console.log(`Registered Opportunities in seo_opportunities: ${mockOpportunities.length}`);

  if (analysis.content_gaps.length === 0) {
    throw new Error('Expected gap engine to identify content gaps between competitor and site');
  }

  console.log('\n✅ ALL PHASE 13 COMPETITOR & CONTENT GAP VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runPhase13Tests().catch((err) => {
  console.error('\n❌ Phase 13 Verification Failed:', err);
  process.exit(1);
});
