export type OpportunityType =
  | "technical_seo"
  | "content"
  | "gsc"
  | "internal_linking"
  | "local_seo"
  | "blog_content"
  | "monitoring"
  | "third_party";

export type OpportunitySeverity = "critical" | "high" | "medium" | "low";
export type OpportunityImpact = "high" | "medium" | "low";
export type OpportunityEffort = "low" | "medium" | "high";
export type OpportunityPriority = "Critical" | "High" | "Medium" | "Low";
export type OpportunityStatus = "new" | "viewed" | "in_progress" | "completed" | "dismissed";
export type AutopilotStatus = "active" | "paused";

export interface SEOOpportunity {
  id: string;
  website_id: string;
  user_id: string;
  type: OpportunityType;
  category: string;
  title: string;
  description: string;
  affected_page?: string | null;
  affected_keyword?: string | null;
  severity: OpportunitySeverity;
  impact: OpportunityImpact;
  effort: OpportunityEffort;
  priority: OpportunityPriority;
  priority_score: number;
  source: string;
  recommended_action: string;
  action_type?: string | null;
  action_payload?: Record<string, any> | null;
  status: OpportunityStatus;
  created_at: string;
  updated_at: string;
}

export interface SEOAutopilotSettings {
  website_id: string;
  user_id: string;
  status: AutopilotStatus;
  scan_frequency: "daily" | "weekly" | "monthly";
  auto_stage_safe_fixes: boolean;
  notify_on_critical: boolean;
  last_scanned_at?: string | null;
  next_scan_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SEOAutopilotActivity {
  id: string;
  website_id: string;
  user_id: string;
  event_type: string;
  title: string;
  details?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface OpportunitySummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
}
