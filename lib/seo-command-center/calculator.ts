import { UnifiedScoreResult, CategoryScoreItem, ConfidenceLevel } from './types';

export const CENTRALIZED_WEIGHTS = {
  core_seo: { weight: 0.20, name: 'Core On-Page SEO', tab: 'overview', source: 'SEO Analysis' },
  technical_seo: { weight: 0.20, name: 'Technical SEO', tab: 'technical-crawl', source: 'Technical Crawl' },
  content_topics: { weight: 0.15, name: 'Content & Topic Coverage', tab: 'topical-authority', source: 'Topical Authority Map' },
  aeo_ai_search: { weight: 0.10, name: 'AEO / AI Search', tab: 'aeo', source: 'AEO Engine' },
  internal_links: { weight: 0.10, name: 'Internal Linking', tab: 'internal-links', source: 'Internal Link Engine' },
  local_seo: { weight: 0.10, name: 'Local SEO', tab: 'local-seo', source: 'Local SEO Engine' },
  search_performance: { weight: 0.10, name: 'Search Performance', tab: 'performance', source: 'Google Search Console' },
  opportunity_health: { weight: 0.05, name: 'Opportunity Health', tab: 'opportunities', source: 'Opportunity Engine' },
};

export function calculateUnifiedSEOScore(inputs: {
  coreSeoScore: number | null;
  coreSeoTimestamp?: string | null;
  technicalScore: number | null;
  technicalTimestamp?: string | null;
  topicCoverageScore: number | null;
  topicTimestamp?: string | null;
  aeoScore: number | null;
  aeoTimestamp?: string | null;
  internalLinkScore: number | null;
  linkTimestamp?: string | null;
  localSeoScore: number | null;
  localTimestamp?: string | null;
  searchPerformanceScore: number | null;
  gscConnected?: boolean;
  opportunityHealthScore: number | null;
}): UnifiedScoreResult {
  const categories: Record<string, CategoryScoreItem> = {};

  const processCategory = (
    key: keyof typeof CENTRALIZED_WEIGHTS,
    rawScore: number | null,
    timestamp: string | null = null,
    extraCondition: boolean = true
  ) => {
    const meta = CENTRALIZED_WEIGHTS[key];
    const isAvailable = rawScore !== null && rawScore >= 0 && extraCondition;

    const scoreVal = isAvailable ? Math.min(100, Math.max(0, Math.round(rawScore!))) : null;
    const status = isAvailable ? 'AVAILABLE' : 'NOT_AVAILABLE';
    const reason = isAvailable
      ? `Calculated from ${meta.source}.`
      : `${meta.name} data is not yet available or configured.`;

    categories[key] = {
      id: key,
      name: meta.name,
      score: scoreVal,
      weight: meta.weight,
      contribution: 0,
      status,
      reason,
      source: meta.source,
      lastAnalyzedAt: isAvailable ? timestamp : null,
      navigationTab: meta.tab,
    };
  };

  processCategory('core_seo', inputs.coreSeoScore, inputs.coreSeoTimestamp);
  processCategory('technical_seo', inputs.technicalScore, inputs.technicalTimestamp);
  processCategory('content_topics', inputs.topicCoverageScore, inputs.topicTimestamp);
  processCategory('aeo_ai_search', inputs.aeoScore, inputs.aeoTimestamp);
  processCategory('internal_links', inputs.internalLinkScore, inputs.linkTimestamp);
  processCategory('local_seo', inputs.localSeoScore, inputs.localTimestamp);
  processCategory('search_performance', inputs.searchPerformanceScore, null, !!inputs.gscConnected);
  processCategory('opportunity_health', inputs.opportunityHealthScore, new Date().toISOString());

  // Calculate available weights & weighted sum
  let availableWeightSum = 0;
  let weightedScoreSum = 0;

  Object.values(categories).forEach((cat) => {
    if (cat.status === 'AVAILABLE' && cat.score !== null) {
      availableWeightSum += cat.weight;
      weightedScoreSum += cat.score * cat.weight;
    }
  });

  const totalWeightSum = 1.0; // 100%

  // Normalize unified score over available weight sum
  const unifiedScore = availableWeightSum > 0 ? Math.round(weightedScoreSum / availableWeightSum) : 0;

  // Compute category contributions normalized to 100
  Object.values(categories).forEach((cat) => {
    if (cat.status === 'AVAILABLE' && cat.score !== null && availableWeightSum > 0) {
      cat.contribution = Math.round(((cat.score * cat.weight) / availableWeightSum) * 10) / 10;
    } else {
      cat.contribution = 0;
    }
  });

  // Calculate Confidence Level based on available weight proportion
  const weightProportion = availableWeightSum / totalWeightSum;
  let confidenceLevel: ConfidenceLevel = 'high';
  if (weightProportion < 0.5) confidenceLevel = 'limited';
  else if (weightProportion < 0.8) confidenceLevel = 'medium';

  return {
    unifiedScore: Math.min(100, Math.max(0, unifiedScore)),
    confidenceLevel,
    availableWeightSum,
    totalWeightSum,
    categories,
  };
}
