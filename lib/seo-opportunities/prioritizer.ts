import {
  OpportunityEffort,
  OpportunityImpact,
  OpportunityPriority,
  OpportunitySeverity,
} from "./types";

export interface PrioritizationInput {
  impact: OpportunityImpact;
  severity: OpportunitySeverity;
  effort: OpportunityEffort;
  gscImpressions?: number;
  isOrphanPage?: boolean;
  scoreDelta?: number;
}

export interface PrioritizationResult {
  priorityScore: number;
  priority: OpportunityPriority;
}

/**
 * Deterministic, explainable opportunity prioritization algorithm.
 * Returns a priority score (0–100) and Priority Level (Critical, High, Medium, Low).
 */
export function calculateOpportunityPriority(input: PrioritizationInput): PrioritizationResult {
  // 1. Impact score (0 - 35 pts)
  let impactPts = 10;
  if (input.impact === "high") impactPts = 35;
  else if (input.impact === "medium") impactPts = 20;

  // 2. Severity score (0 - 25 pts)
  let severityPts = 5;
  if (input.severity === "critical") severityPts = 25;
  else if (input.severity === "high") severityPts = 18;
  else if (input.severity === "medium") severityPts = 10;

  // 3. Effort efficiency score (0 - 20 pts)
  let effortPts = 5;
  if (input.effort === "low") effortPts = 20;
  else if (input.effort === "medium") effortPts = 12;

  // 4. Search visibility & special factors bonus (0 - 20 pts)
  let visibilityPts = 0;
  if (input.gscImpressions) {
    if (input.gscImpressions >= 1000) visibilityPts += 20;
    else if (input.gscImpressions >= 250) visibilityPts += 14;
    else if (input.gscImpressions >= 50) visibilityPts += 8;
    else visibilityPts += 4;
  }
  if (input.isOrphanPage) visibilityPts += 5;
  if (input.scoreDelta && input.scoreDelta < 0) {
    visibilityPts += Math.min(15, Math.abs(input.scoreDelta) * 2);
  }

  // Calculate total score bounded strictly 0 - 100
  const rawScore = impactPts + severityPts + effortPts + visibilityPts;
  const priorityScore = Math.min(100, Math.max(0, Number(rawScore.toFixed(2))));

  // Map to Priority Level
  let priority: OpportunityPriority = "Low";
  if (priorityScore >= 85) {
    priority = "Critical";
  } else if (priorityScore >= 70) {
    priority = "High";
  } else if (priorityScore >= 50) {
    priority = "Medium";
  } else {
    priority = "Low";
  }

  return { priorityScore, priority };
}
