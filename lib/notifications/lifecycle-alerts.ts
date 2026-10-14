export type LifecycleEventType =
  | "trial_reminder_day7"
  | "trial_reminder_day9"
  | "trial_expired_day10"
  | "subscription_expired_retention_start"
  | "retention_warning_14d"
  | "retention_warning_7d"
  | "retention_warning_1d";

export interface LifecycleAlertParams {
  userId: string;
  websiteId?: string;
  websiteTitle?: string;
  eventType: LifecycleEventType;
  daysRemaining?: number;
  retentionDeadline?: string;
}

export interface LifecycleAlertResult {
  sent: boolean;
  channel: "email" | "dry_run";
  recipient?: string;
  reason?: string;
  dashboardEventCreated: boolean;
}

/**
 * Dispatches customer notification alerts across trial and retention lifecycle milestones.
 * Uses existing Resend HTTP dispatcher pattern with dry-run fallback when feature flags or API keys are absent.
 */
export async function dispatchLifecycleAlert(
  supabase: any,
  params: LifecycleAlertParams
): Promise<LifecycleAlertResult> {
  const result: LifecycleAlertResult = {
    sent: false,
    channel: "dry_run",
    dashboardEventCreated: false,
  };

  try {
    const { userId, websiteId, websiteTitle = "Your Website", eventType, daysRemaining, retentionDeadline } = params;

    // 1. Configure message copy and severity based on lifecycle event
    let subject = "";
    let title = "";
    let message = "";
    let severity: "info" | "warning" | "critical" = "info";

    switch (eventType) {
      case "trial_reminder_day7":
        subject = `[Codeaxys] Your website trial expires in ${daysRemaining ?? 3} days`;
        title = `Website Trial Ending Soon (${daysRemaining ?? 3} Days Left)`;
        message = `Your 10-day initial trial for "${websiteTitle}" has ${daysRemaining ?? 3} days remaining. Upgrade to a paid plan to keep public hosting active and connect a custom domain.`;
        severity = "info";
        break;

      case "trial_reminder_day9":
        subject = `[Codeaxys] Action Required: 1 day left on your website trial`;
        title = `1 Day Left on Website Trial`;
        message = `Your initial trial for "${websiteTitle}" expires tomorrow. Subscribe to an active plan today to maintain continuous public visitor access.`;
        severity = "warning";
        break;

      case "trial_expired_day10":
        subject = `[Codeaxys] Your 10-day website trial has ended`;
        title = `10-Day Website Trial Ended`;
        message = `The 10-day trial for "${websiteTitle}" has ended. Public access is temporarily suspended, but your website pages, designs, and media are safely preserved in your dashboard for 90 days. Upgrade anytime to restore public hosting.`;
        severity = "critical";
        break;

      case "subscription_expired_retention_start":
        subject = `[Codeaxys] Subscription expired - Website data saved for 90 days`;
        title = `Subscription Expired - 90-Day Retention Active`;
        message = `Your Codeaxys subscription has ended. Public visitor access for your websites is currently suspended, but all your website content remains safely preserved in your account for 90 days. Renew your subscription to restore your live websites instantly.`;
        severity = "critical";
        break;

      case "retention_warning_14d":
        subject = `[Codeaxys] Urgent: 14 days before permanent website deletion`;
        title = `14 Days Remaining Before Website Deletion`;
        message = `Your website "${websiteTitle}" has been inactive for over 75 days. You have 14 days remaining before eligible website data is permanently deleted on ${retentionDeadline || "the scheduled deadline"}. Log in and renew to protect your data.`;
        severity = "warning";
        break;

      case "retention_warning_7d":
        subject = `[Codeaxys] Final Notice: 7 days until website data deletion`;
        title = `7 Days Until Permanent Website Deletion`;
        message = `Final warning: All content, pages, and media for "${websiteTitle}" will be permanently removed in 7 days unless your subscription is renewed.`;
        severity = "critical";
        break;

      case "retention_warning_1d":
        subject = `[Codeaxys] CRITICAL: Your website data will be deleted tomorrow`;
        title = `24 Hours Until Permanent Deletion`;
        message = `This is your last notice. The 90-day retention window for "${websiteTitle}" closes tomorrow. Renew immediately to preserve your website.`;
        severity = "critical";
        break;
    }

    // 2. Fetch recipient email from user profile or subscription metadata
    let recipientEmail: string | null = null;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();

      if (profile?.email) {
        recipientEmail = profile.email;
      }
    } catch {}

    if (!recipientEmail) {
      try {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("metadata")
          .eq("user_id", userId)
          .maybeSingle();

        const meta = sub?.metadata as Record<string, unknown> | undefined;
        if (meta && typeof meta.email === "string") {
          recipientEmail = meta.email;
        }
      } catch {}
    }

    result.recipient = recipientEmail || undefined;

    // 3. Record in dashboard notifications (seo_monitoring_events)
    try {
      if (websiteId) {
        const { error: eventErr } = await supabase
          .from("seo_monitoring_events")
          .insert({
            website_id: websiteId,
            user_id: userId,
            event_type: eventType,
            severity,
            title,
            message,
            metadata: {
              event_type: eventType,
              website_title: websiteTitle,
              days_remaining: daysRemaining,
              notified_at: new Date().toISOString(),
            },
            is_read: false,
          });

        if (!eventErr) {
          result.dashboardEventCreated = true;
        }
      }
    } catch {}

    // 4. Outbound Email Dispatch (Resend API)
    const featureEnabled = process.env.FEATURE_OUTBOUND_ALERTS === "true";
    const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY;

    if (!recipientEmail || !featureEnabled || !apiKey) {
      console.log(
        `[LIFECYCLE_ALERT_DRY_RUN] event=${eventType} recipient=${recipientEmail || "none"} title="${title}"`
      );
      result.channel = "dry_run";
      result.sent = false;
      result.reason = !recipientEmail ? "No recipient email" : !featureEnabled ? "FEATURE_OUTBOUND_ALERTS disabled" : "Missing API Key";
      return result;
    }

    if (process.env.RESEND_API_KEY) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.ALERT_SENDER_EMAIL || "Codeaxys <notifications@codeaxys.com>",
          to: [recipientEmail],
          subject,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: ${severity === "critical" ? "#e11d48" : severity === "warning" ? "#d97706" : "#2563eb"}; margin-top: 0;">${title}</h2>
              <p style="font-size: 15px; line-height: 1.6; color: #334155;">${message}</p>
              <div style="margin: 24px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://codeaxys.com"}/pricing" 
                   style="background: #7c3aed; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                  View Plans & Restore Live Access →
                </a>
              </div>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #64748b;">Codeaxys AI Website Builder • Automated Lifecycle System</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        result.sent = false;
        result.channel = "email";
        result.reason = `HTTP ${response.status}`;
        return result;
      }

      result.sent = true;
      result.channel = "email";
      return result;
    }

    return result;
  } catch (err: any) {
    console.error("[LifecycleAlert] Unexpected error dispatching alert:", err?.message || err);
    result.sent = false;
    result.reason = err?.message || "Unknown error";
    return result;
  }
}
