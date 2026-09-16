export interface AEOBreakdown {
  answerClarity: number; // 0 - 20 pts
  questionCoverage: number; // 0 - 15 pts
  contentStructure: number; // 0 - 15 pts
  entityUnderstanding: number; // 0 - 15 pts
  semanticRelevance: number; // 0 - 15 pts
  structuredData: number; // 0 - 10 pts
  topicDepth: number; // 0 - 10 pts
}

export interface EntityClarity {
  businessName: string | null;
  organization: string | null;
  city: string | null;
  phone: string | null;
  brand: string | null;
  productsServices: string[];
  missingEntities: string[];
  clarityScore: number; // 0 - 100
}

export interface DiscoveredQuestion {
  id: string;
  question: string;
  source: 'content_audit' | 'gsc' | 'faq_section';
  intent: 'informational' | 'transactional' | 'navigational';
  hasDirectAnswer: boolean;
  pagePath: string;
  suggestedAnswerSnippet?: string;
}

export interface TopicCluster {
  id: string;
  mainTopic: string;
  supportingTopics: string[];
  subtopics: string[];
  relatedPages: string[];
  relatedBlogPosts: string[];
  clusterCoverageScore: number; // 0 - 100
  readinessScore: number; // 0 - 100
  missingSubtopics: string[];
}

export interface ContentGap {
  id: string;
  mainTopic: string;
  missingTopic: string;
  suggestedTitle: string;
  reason: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'high' | 'medium' | 'low';
}

export interface WebsiteAEOAnalysis {
  website_id: string;
  user_id: string;
  answer_readiness_score: number;
  topic_coverage_score: number;
  aeo_breakdown: AEOBreakdown;
  entity_clarity: EntityClarity;
  questions_discovered: DiscoveredQuestion[];
  topic_clusters: TopicCluster[];
  content_gaps: ContentGap[];
  last_analyzed_at: string;
  created_at?: string;
  updated_at?: string;
}
