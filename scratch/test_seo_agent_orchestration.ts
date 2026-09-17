import { detectSEOIntent, SEOAgentMessageRef } from "../lib/seo-agent-intent";

async function runTests() {
  console.log("==========================================");
  console.log("RUNNING SEO AGENT ORCHESTRATION UNIT TESTS");
  console.log("==========================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${testName} - ${detail || "Assertion failed"}`);
      failed++;
    }
  }

  // TEST 1: Overall SEO English
  const res1 = detectSEOIntent("How is my website SEO?");
  assert(
    res1.primaryIntent === "OVERALL_SEO",
    "Test 1: 'How is my website SEO?' maps to OVERALL_SEO",
    `Got ${res1.primaryIntent}`
  );

  // TEST 2: Malayalam script
  const res2 = detectSEOIntent("എന്റെ website SEO എങ്ങനെയുണ്ട്?");
  assert(
    res2.detectedLanguage === "mixed" || res2.detectedLanguage === "malayalam",
    "Test 2: Malayalam script language detection",
    `Got ${res2.detectedLanguage}`
  );
  assert(
    res2.primaryIntent === "OVERALL_SEO" || res2.primaryIntent === "SEO_SCORE",
    "Test 2: Malayalam query intent detection",
    `Got ${res2.primaryIntent}`
  );

  // TEST 3: Manglish query
  const res3 = detectSEOIntent("ente SEO engane improve cheyyam?");
  assert(
    res3.detectedLanguage === "manglish",
    "Test 3: Manglish language detection",
    `Got ${res3.detectedLanguage}`
  );
  assert(
    res3.primaryIntent === "SEO_IMPROVEMENT" || res3.secondaryIntents.includes("SEO_IMPROVEMENT"),
    "Test 3: Manglish improvement intent detection",
    `Got ${res3.primaryIntent}`
  );

  // TEST 4: Google Rankings query
  const res4 = detectSEOIntent("Where is my website ranking on Google?");
  assert(
    res4.primaryIntent === "GOOGLE_RANKINGS" || res4.secondaryIntents.includes("GSC"),
    "Test 4: Google Rankings intent",
    `Got ${res4.primaryIntent}`
  );

  // TEST 5: Technical issues query
  const res5 = detectSEOIntent("Do I have broken links or orphan pages?");
  assert(
    res5.primaryIntent === "TECHNICAL_ISSUES" || res5.secondaryIntents.includes("ORPHAN_PAGES"),
    "Test 5: Technical issues intent",
    `Got ${res5.primaryIntent}`
  );

  // TEST 6: Local SEO query
  const res6 = detectSEOIntent("How is my local SEO?");
  assert(
    res6.primaryIntent === "LOCAL_SEO",
    "Test 6: Local SEO intent",
    `Got ${res6.primaryIntent}`
  );

  // TEST 7: AEO & AI Search query
  const res7 = detectSEOIntent("How ready is my website for AI search?");
  assert(
    res7.primaryIntent === "AEO",
    "Test 7: AEO intent",
    `Got ${res7.primaryIntent}`
  );

  // TEST 8: Fix request with pronoun resolution
  const historyMsg: SEOAgentMessageRef[] = [
    { role: "user", content: "Check canonical URL issue" },
    { role: "assistant", content: "I found a canonical mismatch on index.html." },
  ];
  const res8 = detectSEOIntent("Fix that.", historyMsg);
  assert(res8.isFixRequest === true, "Test 8: 'Fix that' detected as fix request");
  assert(
    res8.resolvedContextTopic === "canonical",
    "Test 8: Pronoun 'that' resolved to 'canonical'",
    `Got ${res8.resolvedContextTopic}`
  );

  // TEST 9: Navigation request
  const res9 = detectSEOIntent("Show me Technical Crawl");
  assert(res9.isNavigationRequest === true, "Test 9: Navigation request detected");
  assert(
    res9.targetTabRoute === "technical-crawl",
    "Test 9: Target route resolved to technical-crawl",
    `Got ${res9.targetTabRoute}`
  );

  console.log("==========================================");
  console.log(`SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log("==========================================");

  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error("Test execution error:", e);
  process.exit(1);
});
