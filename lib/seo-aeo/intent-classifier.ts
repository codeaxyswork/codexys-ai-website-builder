import { DiscoveredQuestion } from "./types";

export type QuestionIntent = DiscoveredQuestion["intent"];

/**
 * Deterministically classifies question intent using conservative, domain-specific pattern matching.
 * Supported intents:
 *   - 'transactional': Purchase, booking, ordering, subscribing, signup actions.
 *   - 'commercial': Comparison, pricing, quotes, reviews, plans, alternatives.
 *   - 'navigational': Login, portal, address, phone, contact, support locations.
 *   - 'informational': Educational explanations, tutorials, definitions, and ambiguous fallbacks.
 */
export function classifyQuestionIntent(rawQuestion: string): QuestionIntent {
  if (!rawQuestion || typeof rawQuestion !== "string") {
    return "informational";
  }

  const clean = rawQuestion.toLowerCase().trim();

  // 1. Transactional Intent Patterns: Direct purchasing, booking, ordering, registering
  const transactionalRegex =
    /\b(buy|purchase|order|subscribe|book|hire|reserve|sign\s*up|signup|register|checkout|get\s*started|enroll)\b/i;
  if (transactionalRegex.test(clean)) {
    return "transactional";
  }

  // 2. Commercial Intent Patterns: Evaluation, pricing, quotes, reviews, vs, alternatives
  const commercialRegex =
    /\b(price|pricing|cost|how\s*much|worth|quote|rates|fees|discount|coupon|promo|plans|tier|best|top|review|reviews|vs|versus|compare|comparison|alternative|alternatives|difference\s*between)\b/i;
  if (commercialRegex.test(clean)) {
    return "commercial";
  }

  // 3. Navigational Intent Patterns: Finding specific portals, accounts, locations, contacts
  const navigationalRegex =
    /\b(log\s*in|login|sign\s*in|signin|portal|dashboard|account|contact\s*us|phone\s*number|office|address|directions|where\s*is\s*located|support|help\s*desk|customer\s*service|opening\s*hours|business\s*hours)\b/i;
  if (navigationalRegex.test(clean)) {
    return "navigational";
  }

  // 4. Default / Informational / Ambiguous
  return "informational";
}
