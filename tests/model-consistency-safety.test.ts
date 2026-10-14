import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { getGeminiConfig } from "@/lib/gemini";
import { GeminiVisibilityAdapter } from "@/lib/ai-visibility/adapters/gemini-adapter";

async function runModelConsistencyTests() {
  console.log("=".repeat(80));
  console.log("GEMINI MODEL CONSISTENCY & FALLBACK SAFETY TEST SUITE");
  console.log("=".repeat(80));

  const originalEnv = { ...process.env };

  try {
    // ------------------------------------------------------------------------
    // Test 1: getGeminiConfig model default
    // ------------------------------------------------------------------------
    console.log("\n--- Test 1: getGeminiConfig Model Defaults ---");
    process.env.GEMINI_API_KEY = "dummy-test-key-for-config";
    delete process.env.GEMINI_MODEL;

    const defaultCfg = getGeminiConfig();
    assert.strictEqual(
      defaultCfg.model,
      "gemini-3.8-flash",
      "Expected default model to be gemini-3.8-flash when GEMINI_MODEL is unset."
    );
    console.log("✅ Passed: getGeminiConfig defaults to gemini-3.8-flash.");

    process.env.GEMINI_MODEL = "gemini-custom-override";
    const customCfg = getGeminiConfig();
    assert.strictEqual(
      customCfg.model,
      "gemini-custom-override",
      "Expected getGeminiConfig to honor GEMINI_MODEL override."
    );
    console.log("✅ Passed: getGeminiConfig respects environment override.");

    // ------------------------------------------------------------------------
    // Test 2: AI Visibility Adapter Model Resolution & Mock Guard
    // ------------------------------------------------------------------------
    console.log("\n--- Test 2: AI Visibility Adapter Model Resolution ---");
    delete process.env.GEMINI_MODEL;
    delete process.env.FEATURE_LIVE_AI_VISIBILITY;

    const adapter = new GeminiVisibilityAdapter();
    assert.strictEqual(
      adapter.defaultModel,
      "gemini-3.8-flash",
      "Expected GeminiVisibilityAdapter to default to gemini-3.8-flash."
    );

    // Mock probe execution (offline, no network)
    const mockProbe = await adapter.executeProbe({
      websiteId: "test-site",
      userId: "test-user",
      prompt: "Who is best in web design?",
      category: "commercial",
      brandName: "Acme Studios",
    });

    assert.strictEqual(mockProbe.isMock, true, "Probe must be marked isMock: true when live feature is disabled.");
    assert.strictEqual(mockProbe.model, "mock-gemini-3.8-flash");
    assert.strictEqual(mockProbe.status, "failed");
    console.log("✅ Passed: GeminiVisibilityAdapter defaults to gemini-3.8-flash and fails closed in mock mode.");

    // ------------------------------------------------------------------------
    // Test 3: Static Scan for Banned Deprecated Models in Fallback Chains
    // ------------------------------------------------------------------------
    console.log("\n--- Test 3: Static Audit of Fallback Chains Across Entire Codebase ---");
    const bannedPatterns = [
      "gemini-3.1-pro-preview",
      "gemini-1.5-flash",
      "gemini-2.5-flash",
    ];

    const sourceFiles = [
      "lib/gemini.ts",
      "lib/seo-ai.ts",
      "lib/assistant-gemini.ts",
      "lib/migration/redesign-engine.ts",
      "lib/seo-agent.ts",
      "lib/seo-content-studio/content-generator.ts",
      "lib/marketing/google-strategy.ts",
      "lib/marketing/campaign-planner.ts",
      "lib/marketing/performance-analyzer.ts",
      "lib/ai/unified-conversation-core.ts",
      "lib/ai/unified-context-orchestrator.ts",
      "lib/ai-visibility/adapters/gemini-adapter.ts",
      "app/api/transcribe/route.ts",
      "app/api/websites/[id]/blog/generate/route.ts",
    ];

    for (const relPath of sourceFiles) {
      const fullPath = path.join(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, "utf-8");

      for (const banned of bannedPatterns) {
        assert.ok(
          !content.includes(`"${banned}"`) && !content.includes(`'${banned}'`),
          `Forbidden deprecated model '${banned}' found in ${relPath}`
        );
      }
    }
    console.log("✅ Passed: All target files verified free of deprecated models (3.1-pro-preview, 1.5-flash, 2.5-flash).");

    // Verify verified active models in primary builder
    const geminiCoreContent = fs.readFileSync(path.join(process.cwd(), "lib/gemini.ts"), "utf-8");
    assert.ok(geminiCoreContent.includes('"gemini-3.8-flash"'), "lib/gemini.ts must include gemini-3.8-flash");
    assert.ok(geminiCoreContent.includes('"gemini-3.7-flash"'), "lib/gemini.ts must include gemini-3.7-flash");
    assert.ok(geminiCoreContent.includes('"gemini-3.6-flash"'), "lib/gemini.ts must include gemini-3.6-flash");
    assert.ok(geminiCoreContent.includes('"gemini-3.5-flash"'), "lib/gemini.ts must include gemini-3.5-flash");
    console.log("✅ Passed: Core builder verifies active fallback chain (3.8 -> 3.7 -> 3.6 -> 3.5).");

    // ------------------------------------------------------------------------
    // Test 4: Transcription Route Model Structure
    // ------------------------------------------------------------------------
    console.log("\n--- Test 4: Transcription Route Candidate Models ---");
    const transcribeRouteContent = fs.readFileSync(
      path.join(process.cwd(), "app/api/transcribe/route.ts"),
      "utf-8"
    );
    assert.ok(
      transcribeRouteContent.includes('"gemini-3.5-transcribe"'),
      "Transcription route must preserve gemini-3.5-transcribe as specialized model."
    );
    assert.ok(
      transcribeRouteContent.includes('"gemini-3.8-flash"'),
      "Transcription route must include gemini-3.8-flash as fallback."
    );
    assert.ok(
      transcribeRouteContent.includes('"gemini-3.7-flash"'),
      "Transcription route must include gemini-3.7-flash as fallback."
    );
    assert.ok(
      transcribeRouteContent.includes('"gemini-3.6-flash"'),
      "Transcription route must include gemini-3.6-flash as fallback."
    );
    assert.ok(
      transcribeRouteContent.includes('"gemini-3.5-flash"'),
      "Transcription route must include gemini-3.5-flash as deep capacity fallback."
    );
    console.log("✅ Passed: Transcription route preserves specialized model and clean fallbacks.");

    // ------------------------------------------------------------------------
    // Test 5: Safe modelVersion Logging Signatures
    // ------------------------------------------------------------------------
    console.log("\n--- Test 5: Verify modelVersion Logging Presence ---");
    const filesWithLogging = [
      "lib/gemini.ts",
      "lib/seo-ai.ts",
      "lib/assistant-gemini.ts",
      "lib/migration/redesign-engine.ts",
      "lib/seo-agent.ts",
      "lib/seo-content-studio/content-generator.ts",
      "lib/ai-visibility/adapters/gemini-adapter.ts",
      "app/api/transcribe/route.ts",
    ];

    for (const relPath of filesWithLogging) {
      const content = fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
      assert.ok(
        content.includes("modelVersion"),
        `Expected ${relPath} to safely capture and log response modelVersion.`
      );
    }
    console.log("✅ Passed: All key AI pipelines safely capture response modelVersion.");

    console.log("\n" + "=".repeat(80));
    console.log("ALL MODEL CONSISTENCY TESTS PASSED! 🎉");
    console.log("=".repeat(80));
  } finally {
    process.env = originalEnv;
  }
}

runModelConsistencyTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
