export type AvailabilityStatus = 'AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'NOT_AVAILABLE';
export type ConfidenceLevel = 'high' | 'medium' | 'limited';
export type FreshnessState = 'fresh' | 'needs_refresh' | 'not_analyzed' | 'not_connected';

export interface CategoryScoreItem {
  id: string;
  name: string;
  score: number | null;
  weight: number; // e.g. 0.20 for 20%
  contribution: number; // e.g. 16.0 points
  status: AvailabilityStatus;
  reason: string;
  source: string;
  lastAnalyzedAt: string | null;
  navigationTab: string;
}

export interface UnifiedScoreResult {
  unifiedScore: number;
  confidenceLevel: ConfidenceLevel;
  availableWeightSum: number;
  totalWeightSum: number;
  categories: Record<string, CategoryScoreItem>;
}

export interface DataFreshnessItem {
  label: string;
  status: FreshnessState;
  lastAnalyzedAt: string | null;
  sourceModule: string;
}

export interface SEOActivityEvent {
  id: string;
  event_type: string;
  title: string;
  details?: string;
  created_at: string;
}

export interface CommandCenterPayload {
  unifiedScoreResult: UnifiedScoreResult;
  dataFreshness: Record<string, DataFreshnessItem>;
  healthSummary: {
    unifiedScore: number;
    confidenceLevel: ConfidenceLevel;
    criticalIssuesCount: number;
    highIssuesCount: number;
    totalOpportunitiesCount: number;
    pagesAffectedCount: number;
    lastAnalysisTimestamp: string | null;
    nextScheduledAnalysis: string | null;
  };
  priorityActions: Array<{
    id: string;
    title: string;
    category: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    priorityScore: number;
    affectedPage?: string;
    reason: string;
    recommendedAction: string;
  }>;
  historicalTrend: Array<{
    date: string;
    unifiedScore: number;
    confidenceLevel: string;
  }>;
  beforeAfterHealth: {
    initialScore?: number;
    currentScore: number;
    scoreChange: number;
    criticalIssuesResolved: number;
    opportunitiesCompleted: number;
  };
  activityTimeline: SEOActivityEvent[];
  autopilotSummary: {
    status: string;
    scanFrequency: string;
    lastRunAt: string | null;
    nextRunAt: string | null;
    opportunitiesDiscovered: number;
  };
  gscSummary: {
    connected: boolean;
    propertyUrl: string | null;
    totalClicks: number;
    totalImpressions: number;
    averageCtr: number;
  };
  thirdPartySummary: {
    connectedProviders: string[];
    availableSources: string[];
  };
}
