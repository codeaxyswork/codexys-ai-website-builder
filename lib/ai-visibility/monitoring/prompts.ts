/**
 * Phase 3C: Controlled Prompt Management System
 * Provides tenant-isolated, controlled prompt generation across standard categories.
 * Prevents arbitrary uncontrolled prompt execution.
 */

import { AiVisibilityPromptCategory } from "../types";

export interface PromptTemplate {
  category: AiVisibilityPromptCategory;
  template: (brandName: string, nicheOrDomain?: string) => string;
}

const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    category: "informational",
    template: (brand, niche) =>
      `What are the key features and services offered by ${brand}${niche ? ` in the ${niche} industry` : ""}?`,
  },
  {
    category: "commercial",
    template: (brand, niche) =>
      `Is ${brand} a reliable choice for ${niche || "business services"}? What are its main advantages?`,
  },
  {
    category: "buyer_intent",
    template: (brand, niche) =>
      `How does pricing and overall value of ${brand} compare to top alternatives in ${niche || "its category"}?`,
  },
  {
    category: "local",
    template: (brand) =>
      `Where is ${brand} located, and what geographic areas or markets do they serve?`,
  },
  {
    category: "competitor",
    template: (brand, niche) =>
      `Who are the main competitors of ${brand}${niche ? ` in ${niche}` : ""}, and how does ${brand} differentiate itself?`,
  },
];

/**
 * Generates bounded, controlled prompts for a brand based on requested categories.
 * Restricts total prompts per execution to maxProbes limit (default 5).
 */
export function generateControlledMonitoringPrompts(
  brandName: string,
  categories: AiVisibilityPromptCategory[] = ["informational", "commercial", "buyer_intent"],
  customPrompts: string[] = [],
  maxPrompts: number = 5
): Array<{ prompt: string; category: AiVisibilityPromptCategory }> {
  const cleanBrand = (brandName || "Brand").trim();
  const defaultCats: AiVisibilityPromptCategory[] = ["informational", "commercial", "buyer_intent"];
  const selectedCategories: AiVisibilityPromptCategory[] = categories.length > 0 ? categories : defaultCats;
  
  const results: Array<{ prompt: string; category: AiVisibilityPromptCategory }> = [];
  const addedPrompts = new Set<string>();

  // 1. Add valid custom prompts first (if within max limit and not empty)
  for (const custom of customPrompts) {
    if (results.length >= maxPrompts) break;
    const trimmed = custom.trim();
    if (trimmed && !addedPrompts.has(trimmed.toLowerCase())) {
      addedPrompts.add(trimmed.toLowerCase());
      results.push({
        prompt: trimmed.slice(0, 500), // Enforce 500 char length bound
        category: "informational",
      });
    }
  }

  // 2. Add controlled template prompts for selected categories
  for (const cat of selectedCategories) {
    const categoryName = cat as AiVisibilityPromptCategory;
    if (results.length >= maxPrompts) break;
    const templateObj = DEFAULT_PROMPT_TEMPLATES.find((t) => t.category === categoryName);
    if (templateObj) {
      const promptText = templateObj.template(cleanBrand);
      if (!addedPrompts.has(promptText.toLowerCase())) {
        addedPrompts.add(promptText.toLowerCase());
        results.push({
          prompt: promptText,
          category: categoryName,
        });
      }
    }
  }

  // Fallback if empty
  if (results.length === 0) {
    results.push({
      prompt: `What services does ${cleanBrand} offer?`,
      category: "informational",
    });
  }

  return results.slice(0, maxPrompts);
}
