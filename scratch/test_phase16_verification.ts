import { calculateUnifiedSEOScore, CENTRALIZED_WEIGHTS } from '../lib/seo-command-center/calculator';
import { aggregateCommandCenterData } from '../lib/seo-command-center/aggregator';

async function runPhase16Tests() {
  console.log('=== RUNNING PHASE 16 SEO COMMAND CENTER & UNIFIED SCORING VERIFICATION ===');

  // Test 1: Weights Configuration Total = 100%
  console.log('\n--- Test 1: Weighting Model Validation ---');
  let totalWeight = 0;
  Object.values(CENTRALIZED_WEIGHTS).forEach((item) => {
    totalWeight += item.weight;
  });
  console.log(`Total Weight Sum: ${Math.round(totalWeight * 100)}%`);
  if (Math.round(totalWeight * 100) !== 100) {
    throw new Error(`Centralized weights total sum is ${totalWeight}, expected 1.0 (100%)`);
  }

  // Test 2: Unified Score Calculation with Full Data
  console.log('\n--- Test 2: Unified Score Calculation (Full Data) ---');
  const fullScoreResult = calculateUnifiedSEOScore({
    coreSeoScore: 85,
    technicalScore: 90,
    topicCoverageScore: 80,
    aeoScore: 75,
    internalLinkScore: 95,
    localSeoScore: 70,
    searchPerformanceScore: 80,
    gscConnected: true,
    opportunityHealthScore: 85,
  });

  console.log(`Unified SEO Score (Full Data): ${fullScoreResult.unifiedScore}/100`);
  console.log(`Confidence Level: ${fullScoreResult.confidenceLevel}`);
  console.log(`Available Weight Sum: ${fullScoreResult.availableWeightSum * 100}%`);
  if (fullScoreResult.unifiedScore <= 0 || fullScoreResult.confidenceLevel !== 'high') {
    throw new Error('Full data unified score calculation failed');
  }

  // Test 3: Unavailable Data Handling & Weight Normalization
  console.log('\n--- Test 3: Unavailable Data Handling (GSC & Local SEO Not Connected) ---');
  const partialScoreResult = calculateUnifiedSEOScore({
    coreSeoScore: 85,
    technicalScore: 90,
    topicCoverageScore: 80,
    aeoScore: 75,
    internalLinkScore: 95,
    localSeoScore: null, // Local SEO not configured
    searchPerformanceScore: null, // GSC not connected
    gscConnected: false,
    opportunityHealthScore: 85,
  });

  console.log(`Unified SEO Score (Partial Data): ${partialScoreResult.unifiedScore}/100`);
  console.log(`Confidence Level: ${partialScoreResult.confidenceLevel}`);
  console.log(`Available Weight Sum: ${partialScoreResult.availableWeightSum * 100}%`);
  console.log(`GSC Category Status: ${partialScoreResult.categories.search_performance.status}`);
  console.log(`Local SEO Category Status: ${partialScoreResult.categories.local_seo.status}`);

  if (
    partialScoreResult.categories.search_performance.status !== 'NOT_AVAILABLE' ||
    partialScoreResult.categories.local_seo.status !== 'NOT_AVAILABLE'
  ) {
    throw new Error('Expected unavailable categories to be marked NOT_AVAILABLE');
  }

  // Test 4: Mock Supabase Command Center Aggregator Payload
  console.log('\n--- Test 4: Command Center Aggregator ---');
  const mockWebsites = [{ id: 'site_100', title: 'Codeaxys Enterprise Web Solutions' }];
  const createMockChain = (table: string) => {
    const chain: any = {
      eq: () => chain,
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      single: async () => ({ data: mockWebsites[0] }),
      maybeSingle: async () => ({ data: null }),
      then: (cb: any) => cb({ data: [] }),
    };
    return chain;
  };

  const mockSupabase: any = {
    from: (table: string) => createMockChain(table),
  };

  const payload = await aggregateCommandCenterData(mockSupabase, 'site_100', 'user_100');
  console.log(`Aggregated Unified Score: ${payload.unifiedScoreResult.unifiedScore}/100`);
  console.log(`Health Summary Score: ${payload.healthSummary.unifiedScore}`);
  console.log(`GSC Connected Status: ${payload.gscSummary.connected}`);
  console.log(`Data Freshness Sources count: ${Object.keys(payload.dataFreshness).length}`);

  if (payload.healthSummary.unifiedScore < 0 || !payload.unifiedScoreResult) {
    throw new Error('Command Center payload aggregation failed');
  }

  console.log('\n✅ ALL PHASE 16 SEO COMMAND CENTER & UNIFIED SCORING VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runPhase16Tests().catch((err) => {
  console.error('\n❌ Phase 16 Verification Failed:', err);
  process.exit(1);
});
