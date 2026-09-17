export interface WebsiteTrialStatus {
  status: "trial_active" | "trial_expired" | "permanent";
  badgeLabel: string;
  badgeColor: "purple" | "amber" | "emerald";
  daysRemaining: number | null;
  hoursRemaining: number | null;
  isExpired: boolean;
  message: string;
}

/**
 * Calculates 3-Day (72-hour) preview trial status based on website created_at timestamp and subscription plan.
 * GUARANTEE: Never deletes website data or pages upon trial expiry.
 */
export function getWebsiteTrialStatus(
  createdAt: string | Date | null | undefined,
  planId: string = "free",
  isPublished: boolean = false
): WebsiteTrialStatus {
  if (planId !== "free" || isPublished) {
    return {
      status: "permanent",
      badgeLabel: isPublished ? "Published" : "Pro Workspace",
      badgeColor: "emerald",
      daysRemaining: null,
      hoursRemaining: null,
      isExpired: false,
      message: "Permanent access active.",
    };
  }

  if (!createdAt) {
    return {
      status: "trial_active",
      badgeLabel: "Preview Active (3 days left)",
      badgeColor: "purple",
      daysRemaining: 3,
      hoursRemaining: 72,
      isExpired: false,
      message: "3-day website preview active.",
    };
  }

  const createdTime = new Date(createdAt).getTime();
  const now = Date.now();
  const ageMs = now - createdTime;
  const trialDurationMs = 3 * 24 * 60 * 60 * 1000; // 72 hours in ms
  const remainingMs = trialDurationMs - ageMs;

  if (remainingMs > 0) {
    const hoursRemaining = Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60)));
    const daysRemaining = Math.ceil(hoursRemaining / 24);

    const label =
      daysRemaining > 1
        ? `Preview Active (${daysRemaining} days left)`
        : `Preview Active (${hoursRemaining}h left)`;

    return {
      status: "trial_active",
      badgeLabel: label,
      badgeColor: "purple",
      daysRemaining,
      hoursRemaining,
      isExpired: false,
      message: `Your 3-day website preview is active (${
        daysRemaining > 1 ? `${daysRemaining} days` : `${hoursRemaining} hours`
      } remaining). All edits and code remain saved.`,
    };
  }

  return {
    status: "trial_expired",
    badgeLabel: "3-Day Preview Trial Expired",
    badgeColor: "amber",
    daysRemaining: 0,
    hoursRemaining: 0,
    isExpired: true,
    message:
      "Your 3-day website preview trial has ended. Your website code, design, and pages remain safely saved. Upgrade your plan to host on custom domains or publish permanently.",
  };
}
