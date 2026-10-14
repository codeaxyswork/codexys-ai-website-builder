export interface WebsiteTrialStatus {
  status: "trial_active" | "trial_expired" | "permanent";
  badgeLabel: string;
  badgeColor: "purple" | "amber" | "emerald";
  daysRemaining: number | null;
  hoursRemaining: number | null;
  isExpired: boolean;
  message: string;
}

export const TRIAL_DURATION_DAYS = 10;
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000; // 240 hours

/**
 * Calculates 10-Day (240-hour) initial trial status based on website created_at timestamp and subscription plan.
 * GUARANTEE: Never deletes website data or pages upon trial expiry; safe 90-day retention applies.
 */
export function getWebsiteTrialStatus(
  createdAt: string | Date | null | undefined,
  planId: string = "free",
  isPublished: boolean = false
): WebsiteTrialStatus {
  const normPlan = (planId || "free").toLowerCase().trim();
  const hasPaidPlan = normPlan !== "free";

  // If user has an active paid plan (Starter, Pro, Business, Agency), the site has permanent active hosting
  if (hasPaidPlan) {
    return {
      status: "permanent",
      badgeLabel: isPublished ? "Published" : "Pro Workspace",
      badgeColor: "emerald",
      daysRemaining: null,
      hoursRemaining: null,
      isExpired: false,
      message: "Permanent access active on paid subscription.",
    };
  }

  // Free accounts receive a 10-day initial trial for each new website
  if (!createdAt) {
    return {
      status: "trial_active",
      badgeLabel: "Trial Active (10 days left)",
      badgeColor: "purple",
      daysRemaining: 10,
      hoursRemaining: 240,
      isExpired: false,
      message: "10-day website trial active.",
    };
  }

  const createdTime = new Date(createdAt).getTime();
  const now = Date.now();
  const ageMs = now - createdTime;
  const remainingMs = TRIAL_DURATION_MS - ageMs;

  if (remainingMs > 0) {
    const hoursRemaining = Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60)));
    const daysRemaining = Math.ceil(hoursRemaining / 24);

    const label =
      daysRemaining > 1
        ? `Trial Active (${daysRemaining} days left)`
        : `Trial Active (${hoursRemaining}h left)`;

    return {
      status: "trial_active",
      badgeLabel: label,
      badgeColor: "purple",
      daysRemaining,
      hoursRemaining,
      isExpired: false,
      message: `Your 10-day website trial is active (${
        daysRemaining > 1 ? `${daysRemaining} days` : `${hoursRemaining} hours`
      } remaining). All edits, pages, and media remain saved.`,
    };
  }

  return {
    status: "trial_expired",
    badgeLabel: "10-Day Trial Expired",
    badgeColor: "amber",
    daysRemaining: 0,
    hoursRemaining: 0,
    isExpired: true,
    message:
      "Your 10-day website trial has ended. Your website code, design, and pages remain safely preserved for 90 days. Upgrade your plan to make your website live permanently or connect a custom domain.",
  };
}

