/**
 * Phase 2A: Configurable Credit & System Settings
 * Standardizes configuration without modifying existing SaaS billing constants.
 */

export const LIVE_AI_VISIBILITY_CONFIG = {
  DEFAULT_FEATURE_ENABLED: false,
  DEFAULT_TIMEOUT_MS: 8000, // 8-second strict timeout for LLM probes
  DEFAULT_MAX_PROMPTS_PER_RUN: 5,
  /** Explicit non-operational placeholder (TBD after official provider pricing verification) */
  ESTIMATED_CREDIT_COST_PER_PROBE_BATCH: 0,
  PROVIDER_CREDIT_COSTS: {
    openai: 0, // Placeholder - TBD
    perplexity: 0, // Placeholder - TBD
    gemini: 0, // Placeholder - TBD
    claude: 0, // Placeholder - TBD
  },
} as const;

export function isLiveAiVisibilityEnabled(): boolean {
  return process.env.FEATURE_LIVE_AI_VISIBILITY === "true";
}
