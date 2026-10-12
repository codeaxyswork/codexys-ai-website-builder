/**
 * Phase 16: Configurable Credit, Rate Limit & System Settings for AI Visibility
 * Replaces non-operational zero-cost placeholders with explicit credit rules,
 * operational limits, and failure safeguards.
 */

export const LIVE_AI_VISIBILITY_CONFIG = {
  DEFAULT_FEATURE_ENABLED: false,
  DEFAULT_TIMEOUT_MS: 8000, // 8-second strict timeout for LLM probes
  DEFAULT_MAX_PROMPTS_PER_RUN: 5,

  // Explicit operational credit costs (Safeguard 4)
  CREDIT_COST_PER_SINGLE_PROBE: 1, // 1 AI credit per single provider probe
  CREDIT_COST_PER_MULTI_PROBE_BATCH: 3, // 3 AI credits for 4-provider parallel batch probe
  PROVIDER_CREDIT_COSTS: {
    openai: 1,
    perplexity: 1,
    gemini: 1,
    claude: 1,
  },

  // Operational limits & safeguards to prevent unmetered usage (Safeguard 4)
  DAILY_PROBE_LIMIT_PER_WEBSITE: 25,
  DAILY_PROBE_LIMIT_PER_USER: 60,
  DUPLICATE_PROBE_WINDOW_MS: 45000, // 45 seconds idempotency window to prevent duplicate charges
} as const;

export function isLiveAiVisibilityEnabled(): boolean {
  return process.env.FEATURE_LIVE_AI_VISIBILITY === "true";
}

export const FEATURE_LIVE_AI_VISIBILITY = isLiveAiVisibilityEnabled();
export const CREDIT_COST_PER_SINGLE_PROBE = LIVE_AI_VISIBILITY_CONFIG.CREDIT_COST_PER_SINGLE_PROBE;
export const CREDIT_COST_PER_MULTI_PROBE_BATCH = LIVE_AI_VISIBILITY_CONFIG.CREDIT_COST_PER_MULTI_PROBE_BATCH;
export const DAILY_PROBE_LIMIT_PER_WEBSITE = LIVE_AI_VISIBILITY_CONFIG.DAILY_PROBE_LIMIT_PER_WEBSITE;
export const DAILY_PROBE_LIMIT_PER_USER = LIVE_AI_VISIBILITY_CONFIG.DAILY_PROBE_LIMIT_PER_USER;
export const PROVIDER_TIMEOUT_MS = LIVE_AI_VISIBILITY_CONFIG.DEFAULT_TIMEOUT_MS;
export const DUPLICATE_PROBE_WINDOW_MS = LIVE_AI_VISIBILITY_CONFIG.DUPLICATE_PROBE_WINDOW_MS;
export const AI_PROBE_ENGINES = ["openai", "perplexity", "gemini", "claude"] as const;

