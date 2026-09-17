import { PLANS } from "../lib/constants";

console.log("=== Testing Codeaxys Pricing Plans ===");

const requiredPlans = ["starter", "pro", "business", "agency"];

requiredPlans.forEach((planId) => {
  const plan = PLANS[planId];
  if (!plan) {
    console.error(`❌ ERROR: Plan ${planId} missing!`);
    process.exit(1);
  }
  console.log(`✅ Plan [${plan.id.toUpperCase()}]: ${plan.name} - ₹${plan.price}/mo | ${plan.maxWebsites} site(s) | ${plan.monthlyCredits} credits | ${plan.storageLimitFormatted} storage`);
});

// Check free plan backward compatibility
if (PLANS.free) {
  console.log(`✅ Backward Compatibility [FREE]: ${PLANS.free.name} - ₹${PLANS.free.price}/mo`);
} else {
  console.error("❌ ERROR: Free plan missing!");
  process.exit(1);
}

console.log("\nAll Pricing Plan assertions passed cleanly!");
