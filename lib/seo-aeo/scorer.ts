import { AEOBreakdown, TopicCluster } from "./types";

export interface AnswerReadinessResult {
  totalScore: number;
  level: "Optimal" | "High" | "Medium" | "Needs Attention";
  breakdown: AEOBreakdown;
  rationale: string[];
}

export interface TopicCoverageResult {
  totalScore: number;
  level: "Comprehensive" | "Good" | "Moderate font-medium" | "Sparse";
  clustersCount: number;
  totalTopicsCovered: number;
  rationale: string[];
}

/**
 * Deterministic Answer Readiness Score calculation (0–100).
 * Explainable breakdown:
 *   - Answer Clarity (0–20 pts)
 *   - Question Coverage (0–15 pts)
 *   - Content Structure (0–15 pts)
 *   - Entity Understanding (0–15 pts)
 *   - Semantic Relevance (0–15 pts)
 *   - Structured Data (0–10 pts)
 *   - Topic Depth (0–10 pts)
 */
export function calculateAnswerReadinessScore(breakdown: AEOBreakdown): AnswerReadinessResult {
  const totalRaw =
    (breakdown.answerClarity || 0) +
    (breakdown.questionCoverage || 0) +
    (breakdown.contentStructure || 0) +
    (breakdown.entityUnderstanding || 0) +
    (breakdown.semanticRelevance || 0) +
    (breakdown.structuredData || 0) +
    (breakdown.topicDepth || 0);

  const totalScore = Math.min(100, Math.max(0, Math.round(totalRaw)));

  let level: "Optimal" | "High" | "Medium" | "Needs Attention" = "Needs Attention";
  if (totalScore >= 85) level = "Optimal";
  else if (totalScore >= 70) level = "High";
  else if (totalScore >= 50) level = "Medium";

  const rationale: string[] = [];
  if (breakdown.answerClarity < 15) {
    rationale.push("Direct answer sections can be formatted more concisely under question headings.");
  }
  if (breakdown.questionCoverage < 10) {
    rationale.push("Include explicit FAQ sections or question-based subheadings across main site pages.");
  }
  if (breakdown.entityUnderstanding < 10) {
    rationale.push("Clarify Business Name, Location, and Core Product/Service entity representations.");
  }
  if (breakdown.structuredData < 7) {
    rationale.push("Add schema markup (Organization/LocalBusiness/FAQPage) to enable rich search snippets.");
  }
  if (rationale.length === 0) {
    rationale.push("Content exhibits excellent answer clarity, entity structure, and semantic readiness.");
  }

  return { totalScore, level, breakdown, rationale };
}

/**
 * Deterministic Topic Coverage Score calculation (0–100).
 */
export function calculateTopicCoverageScore(clusters: TopicCluster[]): TopicCoverageResult {
  if (!clusters || clusters.length === 0) {
    return {
      totalScore: 0,
      level: "Sparse",
      clustersCount: 0,
      totalTopicsCovered: 0,
      rationale: ["No topic clusters indexed yet. Publish content to build topical authority."],
    };
  }

  const clustersCount = clusters.length;
  let totalTopics = 0;
  let sumClusterScores = 0;

  clusters.forEach((c) => {
    totalTopics += 1 + (c.supportingTopics?.length || 0) + (c.subtopics?.length || 0);
    sumClusterScores += c.clusterCoverageScore || 0;
  });

  const avgClusterScore = sumClusterScores / clustersCount;
  // Bonus for breadth of clusters and total topic coverage
  const breadthBonus = Math.min(20, clustersCount * 5 + Math.floor(totalTopics / 2));
  const totalScore = Math.min(100, Math.max(0, Math.round(avgClusterScore * 0.8 + breadthBonus)));

  let level: "Comprehensive" | "Good" | "Moderate font-medium" | "Sparse" = "Sparse";
  if (totalScore >= 80) level = "Comprehensive";
  else if (totalScore >= 65) level = "Good";
  else if (totalScore >= 45) level = "Moderate font-medium";

  const rationale: string[] = [];
  if (totalScore >= 80) {
    rationale.push(`Strong topical depth with ${clustersCount} active topic clusters and ${totalTopics} subtopics.`);
  } else {
    rationale.push(`Coverage spans ${clustersCount} cluster(s). Expand supporting articles for incomplete subtopics.`);
  }

  return {
    totalScore,
    level,
    clustersCount,
    totalTopicsCovered: totalTopics,
    rationale,
  };
}
