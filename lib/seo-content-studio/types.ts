export interface ContentBrief {
  id?: string;
  website_id: string;
  user_id: string;
  topic: string;
  primary_keyword: string;
  secondary_keywords: string[];
  search_intent: 'informational' | 'transactional' | 'commercial' | 'navigational';
  target_audience: string;
  content_type: 'blog_post' | 'landing_page' | 'guide' | 'faq';
  topic_cluster?: string;
  desired_tone: string;
  opportunity_id?: string;
  source_recommendations: {
    source: 'GSC' | 'COMPETITOR_GAP' | 'TOPICAL_AUTHORITY' | 'INTERNAL_LINKING' | 'USER';
    label: string;
    details: string;
  }[];
  gsc_context?: {
    queries: string[];
    impressions?: number;
    clicks?: number;
  };
  competitor_gap_context?: {
    competitor_domain?: string;
    missing_topic?: string;
    missing_keywords?: string[];
  };
  internal_link_opportunities?: {
    target_path: string;
    target_title: string;
    anchor_suggestion: string;
  }[];
  created_at?: string;
}

export interface ContentOutlineSection {
  heading_level: 'H2' | 'H3';
  title: string;
  content_goal: string;
  key_points: string[];
  questions_to_answer: string[];
  suggested_internal_link?: {
    path: string;
    anchor: string;
  };
}

export interface ContentOutline {
  suggested_title: string;
  h1: string;
  meta_description: string;
  introduction_goal: string;
  aeo_direct_answer_target: string;
  sections: ContentOutlineSection[];
  faq_opportunities: {
    question: string;
    answer_guidance: string;
  }[];
  structured_data_types: string[];
  internal_link_summary: string[];
}

export interface ContentQualityBreakdown {
  word_count: number;
  paragraph_count: number;
  heading_count: number;
  readability_score: number; // 0 - 100
  heading_structure_score: number; // 0 - 100
  question_coverage_score: number; // 0 - 100
  topic_coverage_score: number; // 0 - 100
  internal_link_score: number; // 0 - 100
  metadata_score: number; // 0 - 100
  aeo_readiness_score: number; // 0 - 100
}

export interface ContentQualityAnalysis {
  overall_score: number; // 0 - 100
  breakdown: ContentQualityBreakdown;
  findings: {
    type: 'success' | 'warning' | 'error';
    category: string;
    message: string;
    recommendation?: string;
  }[];
}

export interface ContentRefreshRecommendation {
  id: string;
  category: 'metadata' | 'content_depth' | 'aeo' | 'internal_links' | 'competitor_gap' | 'freshness';
  severity: 'critical' | 'high' | 'medium' | 'low';
  what: string;
  why: string;
  where: string;
  suggested_action: string;
}

export interface ContentRefreshReport {
  target_id: string;
  target_type: 'blog' | 'page';
  title: string;
  quality_score: number;
  metadata_freshness: 'fresh' | 'needs_update' | 'outdated';
  topic_coverage_score: number;
  aeo_readiness_score: number;
  recommendations: ContentRefreshRecommendation[];
  analysis_timestamp: string;
}

export interface BeforeAfterDiff {
  before_title: string;
  after_title: string;
  before_seo_title?: string;
  after_seo_title?: string;
  before_meta_description?: string;
  after_meta_description?: string;
  before_focus_keyword?: string;
  after_focus_keyword?: string;
  added_lines_count: number;
  removed_lines_count: number;
  modified_sections_count: number;
  metadata_changed: boolean;
  content_diff_html: string;
  heading_changes: {
    type: 'added' | 'removed' | 'modified';
    heading: string;
  }[];
  internal_link_changes: {
    added_links: string[];
    removed_links: string[];
  };
}
