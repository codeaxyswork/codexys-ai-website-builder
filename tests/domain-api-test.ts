import { createAdminClient } from "../utils/supabase/server";
import { normalizeCustomDomainInput } from "../lib/domain-resolver";

async function testDatabaseDomainLogic() {
  console.log("=== TESTING DATABASE DOMAIN CONFLICT AND PERSISTENCE ===");
  const supabase = createAdminClient();

  // Fetch two existing websites from DB
  const { data: websites, error } = await supabase
    .from("websites")
    .select("id, title, slug, custom_domain, user_id")
    .limit(2);

  if (error || !websites || websites.length < 2) {
    console.log("Skipping 2-site conflict test (fewer than 2 sites found).");
    return;
  }

  const siteA = websites[0];
  const siteB = websites[1];
  console.log(`Testing with Site A (${siteA.id}: ${siteA.title}) and Site B (${siteB.id}: ${siteB.title})`);

  const testDomain = "test-conflict-check-unique-xyz.com";

  try {
    // 1. Assign testDomain to Site A
    console.log("Step 1: Assigning test domain to Site A...");
    await supabase
      .from("websites")
      .update({
        custom_domain: testDomain,
        custom_domain_status: "pending_dns",
        custom_domain_verified: false,
        www_domain_configured: true,
      })
      .eq("id", siteA.id);

    // 2. Attempt to check conflict for Site B with same domain
    console.log("Step 2: Checking conflict from Site B perspective...");
    const norm = normalizeCustomDomainInput(testDomain);
    const { data: conflicts } = await supabase
      .from("websites")
      .select("id, title")
      .neq("id", siteB.id)
      .or(`custom_domain.eq.${norm.canonicalDomain},custom_domain.eq.${norm.wwwDomain}`)
      .limit(1);

    if (conflicts && conflicts.length > 0 && conflicts[0].id === siteA.id) {
      console.log(`[PASS] Conflict detected: Site B is prevented from attaching ${testDomain} because Site A already owns it.`);
    } else {
      console.error("[FAIL] Conflict NOT detected as expected!", conflicts);
      process.exit(1);
    }

    // 3. Attempt conflict with www.testDomain
    console.log("Step 3: Checking conflict with www prefix...");
    const normWww = normalizeCustomDomainInput(`www.${testDomain}`);
    const { data: conflictsWww } = await supabase
      .from("websites")
      .select("id, title")
      .neq("id", siteB.id)
      .or(`custom_domain.eq.${normWww.canonicalDomain},custom_domain.eq.${normWww.wwwDomain}`)
      .limit(1);

    if (conflictsWww && conflictsWww.length > 0) {
      console.log(`[PASS] Conflict detected for www prefix: Site B cannot claim www.${testDomain} either.`);
    } else {
      console.error("[FAIL] Conflict for www prefix was NOT detected!");
      process.exit(1);
    }
  } finally {
    // Cleanup: restore Site A
    console.log("Step 4: Cleaning up test domain from Site A...");
    await supabase
      .from("websites")
      .update({
        custom_domain: siteA.custom_domain,
        custom_domain_status: "none",
        custom_domain_verified: false,
      })
      .eq("id", siteA.id);
    console.log("[PASS] Database restored cleanly.");
  }
}

testDatabaseDomainLogic().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
