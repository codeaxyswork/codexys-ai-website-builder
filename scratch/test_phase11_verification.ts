import { calculateOpportunityPriority } from '../lib/seo-opportunities/prioritizer';
import { runOpportunityScan } from '../lib/seo-opportunities/engine';
import { getAutopilotSettings, updateAutopilotSettings, runAutopilotCycle } from '../lib/seo-opportunities/autopilot';

async function runPhase11Tests() {
  console.log('=== RUNNING PHASE 11 SEO AUTOPILOT & OPPORTUNITY ENGINE VERIFICATION ===');

  // Test 1: Prioritization Algorithm
  console.log('\n--- Test 1: Prioritization Algorithm ---');
  const criticalScore = calculateOpportunityPriority({
    impact: 'high',
    severity: 'critical',
    effort: 'low',
    gscImpressions: 1200,
    isOrphanPage: true,
  });
  console.log(`Critical High Impact Score: ${criticalScore.priorityScore}/100 (Level: ${criticalScore.priority})`);
  if (criticalScore.priority !== 'Critical' || criticalScore.priorityScore < 85) {
    throw new Error(`Expected Critical priority level, got ${criticalScore.priority} with score ${criticalScore.priorityScore}`);
  }

  const mediumScore = calculateOpportunityPriority({
    impact: 'medium',
    severity: 'medium',
    effort: 'medium',
    gscImpressions: 100,
    isOrphanPage: false,
  });
  console.log(`Medium Impact Score: ${mediumScore.priorityScore}/100 (Level: ${mediumScore.priority})`);

  // Test 2: Mock Supabase Client for Engine Scanning & Autopilot
  console.log('\n--- Test 2: Opportunity Engine Scanner Logic ---');

  // Mock DB tables
  const mockWebsites = [{ id: 'site_123', title: 'Test Business Site', published_slug: 'test-business' }];
  const mockWebsiteSeo = [{ website_id: 'site_123', seo_score: 65, seo_title: 'Home', meta_description: '', canonical_url: '' }];
  const mockPagesSeo = [
    { website_id: 'site_123', path: '/', seo_score: 60, critical_issues_count: 2, is_orphaned: false, is_thin_content: false, has_missing_meta_desc: true },
    { website_id: 'site_123', path: '/about', seo_score: 40, critical_issues_count: 3, is_orphaned: true, is_thin_content: true, has_missing_meta_desc: true },
  ];
  const mockOpportunities: any[] = [];
  const mockAutopilotSettings: any[] = [
    {
      website_id: 'site_123',
      user_id: 'user_123',
      status: 'active',
      scan_frequency: 'weekly',
      auto_apply_safe_fixes: false,
      require_approval_for_staging: true,
      enabled_categories: ['technical', 'content', 'internal_linking', 'gsc', 'local_seo', 'integrations'],
    },
  ];
  const mockAutopilotActivity: any[] = [];

  const createChain = (table: string, siteIdVal: string) => {
    let filterStatus: string[] | null = null;
    const chain: any = {
      single: async () => {
        if (table === 'websites') return { data: mockWebsites.find((w) => w.id === siteIdVal) };
        if (table === 'website_seo') return { data: mockWebsiteSeo.find((s) => s.website_id === siteIdVal) };
        if (table === 'seo_autopilot_settings') return { data: mockAutopilotSettings.find((s) => s.website_id === siteIdVal) };
        return { data: null };
      },
      maybeSingle: async () => {
        if (table === 'website_seo') return { data: mockWebsiteSeo.find((s) => s.website_id === siteIdVal) };
        if (table === 'seo_autopilot_settings') return { data: mockAutopilotSettings.find((s) => s.website_id === siteIdVal) };
        if (table === 'website_internal_links') return { data: null };
        if (table === 'website_local_seo') return { data: null };
        return { data: null };
      },
      in: (col: string, vals: any[]) => {
        filterStatus = vals;
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      then: (cb: any) => {
        if (table === 'website_page_seo') return cb({ data: mockPagesSeo.filter((p) => p.website_id === siteIdVal) });
        if (table === 'blog_posts') return cb({ data: [] });
        if (table === 'gsc_search_analytics') return cb({ data: [] });
        if (table === 'seo_monitoring_events') return cb({ data: [] });
        if (table === 'website_third_party_seo_integrations') return cb({ data: [] });
        if (table === 'seo_opportunities') {
          let list = mockOpportunities.filter((o) => o.website_id === siteIdVal);
          if (filterStatus) list = list.filter((o) => filterStatus!.includes(o.status));
          return cb({ data: list });
        }
        if (table === 'seo_autopilot_activity') return cb({ data: mockAutopilotActivity.filter((a) => a.website_id === siteIdVal) });
        return cb({ data: [] });
      },
    };
    return chain;
  };

  const mockSupabase: any = {
    from: (table: string) => ({
      select: (cols?: string) => ({
        eq: (col: string, val: any) => createChain(table, val),
      }),
      insert: (rows: any[]) => ({
        select: () => ({
          single: async () => {
            const inserted = { id: `id_${Date.now()}_${Math.random()}`, ...(Array.isArray(rows) ? rows[0] : rows) };
            if (table === 'seo_opportunities') mockOpportunities.push(inserted);
            if (table === 'seo_autopilot_activity') mockAutopilotActivity.push(inserted);
            return { data: inserted };
          },
          maybeSingle: async () => {
            const inserted = { id: `id_${Date.now()}_${Math.random()}`, ...(Array.isArray(rows) ? rows[0] : rows) };
            if (table === 'seo_opportunities') mockOpportunities.push(inserted);
            if (table === 'seo_autopilot_activity') mockAutopilotActivity.push(inserted);
            return { data: inserted };
          },
        }),
        then: async (cb: any) => {
          rows.forEach((r) => {
            const inserted = { id: `id_${Date.now()}_${Math.random()}`, ...r };
            if (table === 'seo_opportunities') mockOpportunities.push(inserted);
            if (table === 'seo_autopilot_activity') mockAutopilotActivity.push(inserted);
          });
          return cb({ data: rows, error: null });
        },
      }),
      update: (row: any) => ({
        eq: (col: string, val: any) => {
          let updatedObj: any = null;
          if (table === 'seo_autopilot_settings') {
            const idx = mockAutopilotSettings.findIndex((s) => s.website_id === val);
            if (idx >= 0) {
              mockAutopilotSettings[idx] = { ...mockAutopilotSettings[idx], ...row };
              updatedObj = mockAutopilotSettings[idx];
            }
          }
          return {
            select: () => ({
              single: async () => ({ data: updatedObj }),
            }),
            then: (cb: any) => cb({ error: null }),
          };
        },
      }),
      upsert: (row: any, opts?: any) => {
        if (table === 'seo_opportunities') {
          const existing = mockOpportunities.find(
            (o) => o.website_id === row.website_id && o.category === row.category && o.affected_page === row.affected_page
          );
          if (existing) {
            return Promise.resolve({ error: { message: 'Duplicate opportunity ignored' } });
          }
          const inserted = { id: `id_${Date.now()}_${Math.random()}`, ...row };
          mockOpportunities.push(inserted);
          return Promise.resolve({ error: null });
        }
        const idx = mockAutopilotSettings.findIndex((s) => s.website_id === row.website_id);
        if (idx >= 0) {
          mockAutopilotSettings[idx] = { ...mockAutopilotSettings[idx], ...row };
          return {
            select: () => ({
              single: async () => ({ data: mockAutopilotSettings[idx] }),
            }),
          };
        }
        mockAutopilotSettings.push(row);
        return {
          select: () => ({
            single: async () => ({ data: row }),
          }),
        };
      },
    }),
  };

  // Run scan
  console.log('Running scan on mock site...');
  const result = await runOpportunityScan(mockSupabase, 'site_123', 'user_123');
  console.log(`Scan completed. Discovered ${result.totalScanned} opportunities, inserted ${result.newDiscovered} new items.`);

  if (result.totalScanned === 0) {
    throw new Error('Expected scanner to detect opportunities for missing meta desc and thin content');
  }

  // Test 3: Deduplication
  console.log('\n--- Test 3: Rescan Deduplication Check ---');
  const rescanResult = await runOpportunityScan(mockSupabase, 'site_123', 'user_123');
  console.log(`Rescan completed. Total scanned: ${rescanResult.totalScanned}, New inserted: ${rescanResult.newDiscovered} (expected 0). Total in DB: ${mockOpportunities.length}`);

  if (rescanResult.newDiscovered !== 0) {
    throw new Error(`Deduplication failed. Rescan inserted ${rescanResult.newDiscovered} duplicate opportunities.`);
  }

  // Test 4: Autopilot Cycle & Activity Logging
  console.log('\n--- Test 4: Autopilot Cycle Execution ---');
  const cycleResult = await runAutopilotCycle(mockSupabase, 'site_123', 'user_123');
  console.log('Autopilot Cycle Result:', cycleResult);
  console.log(`Autopilot Activity Logs count: ${mockAutopilotActivity.length}`);

  if (cycleResult.status !== 'completed') {
    throw new Error('Autopilot cycle failed');
  }

  // Test 5: Autopilot Settings Update
  console.log('\n--- Test 5: Autopilot Settings Update ---');
  const updatedSettings = await updateAutopilotSettings(mockSupabase, 'site_123', 'user_123', {
    status: 'paused',
    scan_frequency: 'daily',
  });
  console.log('Updated Autopilot Settings Status:', updatedSettings.status, 'Frequency:', updatedSettings.scan_frequency);

  if (updatedSettings.status !== 'paused' || updatedSettings.scan_frequency !== 'daily') {
    throw new Error('Autopilot settings update failed');
  }

  console.log('\n✅ ALL PHASE 11 SEO AUTOPILOT & OPPORTUNITY ENGINE VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runPhase11Tests().catch((err) => {
  console.error('\n❌ Phase 11 Verification Failed:', err);
  process.exit(1);
});
