import { SEOIntegrationAdapter, SEOProviderConfig } from "./types";
import { ahrefsAdapter } from "./providers/ahrefs";
import { semrushAdapter } from "./providers/semrush";
import { mozAdapter } from "./providers/moz";
import { otherAdapter } from "./providers/other";

const registry: Map<string, SEOIntegrationAdapter> = new Map([
  ["ahrefs", ahrefsAdapter],
  ["semrush", semrushAdapter],
  ["moz", mozAdapter],
  ["other", otherAdapter],
]);

/**
 * Retrieves the registered adapter for a given provider ID.
 */
export function getProviderAdapter(providerId: string): SEOIntegrationAdapter | null {
  if (!providerId) return null;
  return registry.get(providerId.toLowerCase()) || null;
}

/**
 * Returns a list of supported provider configurations for UI rendering.
 */
export function listSupportedProviders(): SEOProviderConfig[] {
  return Array.from(registry.values()).map((adapter) => adapter.config);
}
