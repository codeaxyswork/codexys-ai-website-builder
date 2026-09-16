export type CompetitorDataSource = "PUBLIC_SITE" | "GSC" | "AHREFS" | "SEMRUSH" | "MOZ";

export interface SEOCompetitor {
  id: string;
  website_id: string;
  user_id: string;
  domain: string;
  name?: string | null;
  status: "active" | "analyzing" | "completed" | "failed";
  last_analyzed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompetitorPageSummary {
  url: string;
  title?: string | null;
  metaDescription?: string | null;
  headings: string[];
  mainTopics: string[];
}

export interface CompetitorTopic {
  topic: string;
  category: string;
  frequency: number;
}

export interface CompetitorGapItem {
  id: string;
  competitorId?: string;
  competitorDomain?: string;
  gapType: "topic" | "content" | "keyword" | "page" | "aeo";
  title: string;
  description: string;
  affectedTopic?: string | null;
  affectedKeyword?: string | null;
  affectedPageType?: string | null;
  severity: "critical" | "high" | "medium" | "low";
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  priority: "Critical" | "High" | "Medium" | "Low";
  priorityScore: number;
  recommendedAction: string;
  actionType: "create_blog_post" | "add_page" | "add_faq_section" | "optimize_keyword";
  dataSource: CompetitorDataSource;
}

export interface CompetitorAnalysis {
  id: string;
  competitor_id: string;
  website_id: string;
  user_id: string;
  scraped_pages: CompetitorPageSummary[];
  extracted_topics: CompetitorTopic[];
  content_gaps: CompetitorGapItem[];
  page_gaps: string[];
  data_source: CompetitorDataSource;
  last_analyzed_at: string;
  created_at?: string;
}

export interface CompetitorSummary {
  totalCompetitors: number;
  analyzedCompetitors: number;
  totalGaps: number;
  gapsByCategory: {
    topic: number;
    content: number;
    keyword: number;
    page: number;
    aeo: number;
  };
  gapsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}
