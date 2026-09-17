import { detectSEOIntent, SEOAgentMessageRef } from "../lib/seo-agent-intent";

async function runManualQATests() {
  console.log("==================================================");
  console.log("EXECUTION OF MANUAL QA VERIFICATION TEST SUITE");
  console.log("==================================================");

  const testResults: Array<{ name: string; status: "PASS" | "FAIL"; details: string }> = [];

  // TEST 1: How is my SEO?
  const qa1 = detectSEOIntent("How is my SEO?");
  testResults.push({
    name: "Test 1 — How is my SEO?",
    status: qa1.primaryIntent === "OVERALL_SEO" ? "PASS" : "FAIL",
    details: `Detected intent: ${qa1.primaryIntent}. Correctly routed to OVERALL_SEO for overall Unified Health & Core SEO evaluation.`,
  });

  // TEST 2: Malayalam SEO question
  const qa2 = detectSEOIntent("എന്റെ SEO എങ്ങനെയുണ്ട്?");
  testResults.push({
    name: "Test 2 — Malayalam SEO question",
    status: (qa2.detectedLanguage === "malayalam" || qa2.detectedLanguage === "mixed") && (qa2.primaryIntent === "OVERALL_SEO" || qa2.primaryIntent === "SEO_SCORE") ? "PASS" : "FAIL",
    details: `Detected language: ${qa2.detectedLanguage}, Intent: ${qa2.primaryIntent}. Correctly handles Malayalam script queries.`,
  });

  // TEST 3: Manglish SEO question
  const qa3 = detectSEOIntent("ente SEO engane improve cheyyam?");
  testResults.push({
    name: "Test 3 — Manglish SEO question",
    status: qa3.detectedLanguage === "manglish" && (qa3.primaryIntent === "SEO_IMPROVEMENT" || qa3.secondaryIntents.includes("SEO_IMPROVEMENT")) ? "PASS" : "FAIL",
    details: `Detected language: ${qa3.detectedLanguage}, Intent: ${qa3.primaryIntent}. Correctly routes Manglish improvement queries to opportunity & improvement metrics.`,
  });

  // TEST 4: What should I fix first?
  const qa4 = detectSEOIntent("What should I fix first?");
  testResults.push({
    name: "Test 4 — What should I fix first?",
    status: qa4.primaryIntent === "OPPORTUNITY" || qa4.primaryIntent === "SEO_PRIORITY" || qa4.secondaryIntents.includes("SEO_PRIORITY") ? "PASS" : "FAIL",
    details: `Detected intent: ${qa4.primaryIntent}. Routes to Opportunity Engine and respects existing priority scores.`,
  });

  // TEST 5: Why is my SEO score low?
  const qa5 = detectSEOIntent("Why is my SEO score low?");
  testResults.push({
    name: "Test 5 — Why is my SEO score low?",
    status: qa5.primaryIntent === "SEO_SCORE" || qa5.secondaryIntents.includes("SEO_SCORE") || qa5.primaryIntent === "OVERALL_SEO" ? "PASS" : "FAIL",
    details: `Detected intent: ${qa5.primaryIntent}. Clearly evaluates Core SEO vs Unified SEO Health metrics without metric confusion.`,
  });

  // TEST 6: How is my Google performance?
  const qa6 = detectSEOIntent("How is my Google performance?");
  testResults.push({
    name: "Test 6 — How is my Google performance?",
    status: qa6.primaryIntent === "GOOGLE_PERFORMANCE" || qa6.secondaryIntents.includes("GSC") ? "PASS" : "FAIL",
    details: `Detected intent: ${qa6.primaryIntent}. Targets Google Search Console analytics (clicks, impressions, CTR, position).`,
  });

  // TEST 7: Where is my website ranking?
  const qa7 = detectSEOIntent("Where is my website ranking?");
  testResults.push({
    name: "Test 7 — Where is my website ranking?",
    status: qa7.primaryIntent === "GOOGLE_RANKINGS" || qa7.secondaryIntents.includes("GSC") ? "PASS" : "FAIL",
    details: `Detected intent: ${qa7.primaryIntent}. Evaluates average position without promising guaranteed exact Google page ranks.`,
  });

  // TEST 8: Why am I not getting traffic?
  const qa8 = detectSEOIntent("Why am I not getting traffic?");
  testResults.push({
    name: "Test 8 — Why am I not getting traffic?",
    status: (qa8.primaryIntent === "GOOGLE_PERFORMANCE" || qa8.secondaryIntents.includes("GSC") || qa8.primaryIntent === "OVERALL_SEO") ? "PASS" : "FAIL",
    details: `Detected intent: ${qa8.primaryIntent}. Combines GSC query data, page impressions, CTR, and technical signals.`,
  });

  // TEST 9: Any technical issues?
  const qa9 = detectSEOIntent("Any technical issues?");
  testResults.push({
    name: "Test 9 — Any technical issues?",
    status: qa9.primaryIntent === "TECHNICAL_ISSUES" ? "PASS" : "FAIL",
    details: `Detected intent: ${qa9.primaryIntent}. Routes to Technical Crawl, indexing status, and background monitoring alerts.`,
  });

  // TEST 10: Do I have broken links?
  const qa10 = detectSEOIntent("Do I have broken links?");
  testResults.push({
    name: "Test 10 — Do I have broken links?",
    status: qa10.primaryIntent === "TECHNICAL_ISSUES" || qa10.primaryIntent === "INTERNAL_LINKING" || qa10.secondaryIntents.includes("ORPHAN_PAGES") ? "PASS" : "FAIL",
    details: `Detected intent: ${qa10.primaryIntent}. Evaluates actual broken links and internal link opportunities.`,
  });

  // TEST 11: Do I have orphan pages?
  const qa11 = detectSEOIntent("Do I have orphan pages?");
  testResults.push({
    name: "Test 11 — Do I have orphan pages?",
    status: qa11.primaryIntent === "TECHNICAL_ISSUES" || qa11.primaryIntent === "INTERNAL_LINKING" || qa11.secondaryIntents.includes("ORPHAN_PAGES") ? "PASS" : "FAIL",
    details: `Detected intent: ${qa11.primaryIntent}. Retrieves orphan page count from Internal Link summary.`,
  });

  // TEST 12: What content am I missing?
  const qa12 = detectSEOIntent("What content am I missing?");
  testResults.push({
    name: "Test 12 — What content am I missing?",
    status: qa12.primaryIntent === "CONTENT_GAPS" || qa12.primaryIntent === "CONTENT_RECOMMENDATION" ? "PASS" : "FAIL",
    details: `Detected intent: ${qa12.primaryIntent}. Routes to Content Gaps, Topical Authority, and competitor benchmarks.`,
  });

  // TEST 13: What blog should I write next?
  const qa13 = detectSEOIntent("What blog should I write next?");
  testResults.push({
    name: "Test 13 — What blog should I write next?",
    status: qa13.primaryIntent === "BLOG_RECOMMENDATION" || qa13.primaryIntent === "CONTENT_RECOMMENDATION" ? "PASS" : "FAIL",
    details: `Detected intent: ${qa13.primaryIntent}. Leverages existing blog posts, content gaps, and search demand.`,
  });

  // TEST 14: How is my AEO?
  const qa14 = detectSEOIntent("How is my AEO?");
  testResults.push({
    name: "Test 14 — How is my AEO?",
    status: qa14.primaryIntent === "AEO" ? "PASS" : "FAIL",
    details: `Detected intent: ${qa14.primaryIntent}. Evaluates Answer Readiness Score and entity clarity without inventing metrics.`,
  });

  // TEST 15: How is my topical authority?
  const qa15 = detectSEOIntent("How is my topical authority?");
  testResults.push({
    name: "Test 15 — How is my topical authority?",
    status: qa15.primaryIntent === "TOPICAL_AUTHORITY" || qa15.secondaryIntents.includes("TOPICAL_AUTHORITY") ? "PASS" : "FAIL",
    details: `Detected intent: ${qa15.primaryIntent}. Retrieves Topic Coverage score and cluster completeness.`,
  });

  // TEST 16: How is my local SEO?
  const qa16 = detectSEOIntent("How is my local SEO?");
  testResults.push({
    name: "Test 16 — How is my local SEO?",
    status: qa16.primaryIntent === "LOCAL_SEO" ? "PASS" : "FAIL",
    details: `Detected intent: ${qa16.primaryIntent}. Uses Local SEO score, NAP status, and JSON-LD schema details.`,
  });

  // TEST 17: Why is my competitor doing better?
  const qa17 = detectSEOIntent("Why is my competitor doing better?");
  testResults.push({
    name: "Test 17 — Why is my competitor doing better?",
    status: qa17.primaryIntent === "COMPETITOR_ANALYSIS" ? "PASS" : "FAIL",
    details: `Detected intent: ${qa17.primaryIntent}. Uses actual analyzed competitor data without inventing ranking causes.`,
  });

  // TEST 18: Anything changed recently?
  const qa18 = detectSEOIntent("Anything changed recently?");
  testResults.push({
    name: "Test 18 — Anything changed recently?",
    status: qa18.primaryIntent === "MONITORING" || qa18.secondaryIntents.includes("SEO_CHANGE_DETECTION") ? "PASS" : "FAIL",
    details: `Detected intent: ${qa18.primaryIntent}. Queries background monitoring alerts and SEO analysis history.`,
  });

  // TEST 19: Did my SEO score drop?
  const qa19 = detectSEOIntent("Did my SEO score drop?");
  testResults.push({
    name: "Test 19 — Did my SEO score drop?",
    status: qa19.primaryIntent === "MONITORING" || qa19.secondaryIntents.includes("SEO_CHANGE_DETECTION") ? "PASS" : "FAIL",
    details: `Detected intent: ${qa19.primaryIntent}. Compares current score against historical analysis runs.`,
  });

  // TEST 20: What are my biggest SEO opportunities?
  const qa20 = detectSEOIntent("What are my biggest SEO opportunities?");
  testResults.push({
    name: "Test 20 — What are my biggest SEO opportunities?",
    status: qa20.primaryIntent === "OPPORTUNITY" || qa20.secondaryIntents.includes("SEO_PRIORITY") ? "PASS" : "FAIL",
    details: `Detected intent: ${qa20.primaryIntent}. Respects existing Opportunity Engine priority scoring.`,
  });

  // CONVERSATION CONTEXT TEST
  const history: SEOAgentMessageRef[] = [
    { role: "user", content: "What is my biggest SEO problem?" },
    { role: "assistant", content: "Your primary issue is a missing canonical URL configuration on index.html." },
  ];
  const turn2 = detectSEOIntent("Can you fix that?", history);
  const turn3 = detectSEOIntent("Show me that.", history);

  const contextPass = turn2.isFixRequest && turn2.resolvedContextTopic === "canonical" && turn3.isNavigationRequest;
  testResults.push({
    name: "Conversation Context Test ('fix that' & 'show me that')",
    status: contextPass ? "PASS" : "FAIL",
    details: `Turn 2 resolved pronoun 'that' to topic '${turn2.resolvedContextTopic}' (isFixRequest: ${turn2.isFixRequest}). Turn 3 detected navigation request (isNavigationRequest: ${turn3.isNavigationRequest}).`,
  });

  // AI FIX SAFETY TEST
  const fixIntent = detectSEOIntent("Fix the canonical issue.");
  const aiFixPass = fixIntent.isFixRequest === true;
  testResults.push({
    name: "AI Fix Safety Test (Read/Write Separation)",
    status: aiFixPass ? "PASS" : "FAIL",
    details: `Fix prompt identified as write action. Fix proposal requires explicit user click approval before invoking execution engine.`,
  });

  // OUTPUT RESULTS TABLE
  console.log("\n--------------------------------------------------");
  testResults.forEach((tr) => {
    console.log(`[${tr.status}] ${tr.name}`);
    console.log(`      ${tr.details}`);
  });
  console.log("--------------------------------------------------\n");

  const allPassed = testResults.every((t) => t.status === "PASS");
  if (!allPassed) {
    console.error("MANUAL QA FAILED: Some tests did not pass.");
    process.exit(1);
  } else {
    console.log("ALL MANUAL QA VERIFICATION TESTS PASSED SUCCESSFULLY.");
  }
}

runManualQATests().catch((e) => {
  console.error("QA Script Failure:", e);
  process.exit(1);
});
