export interface MigrationTrialAlertParams {
  websiteId: string;
  websiteTitle: string;
  userId: string;
  day: 7 | 9 | 10;
  daysRemaining: number;
}

export interface MigrationTrialAlertResult {
  emailSent: boolean;
  dashboardEventCreated: boolean;
  recipient?: string;
  channel: "email" | "dry_run";
  error?: string;
}

export interface MinimalDbClient {
  from: (table: string) => {
    select: (fields?: string) => {
      eq: (col: string, val: unknown) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
    insert: (data: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
}

/**
 * Dispatches customer reminders on Day 7, Day 9, and Day 10 of the migration trial.
 * Uses existing email infrastructure (Resend with dry-run fallback) and dashboard notifications (seo_monitoring_events).
 */
export async function dispatchMigrationTrialAlert(
  supabase: MinimalDbClient,
  params: MigrationTrialAlertParams
): Promise<MigrationTrialAlertResult> {
  const result: MigrationTrialAlertResult = {
    emailSent: false,
    dashboardEventCreated: false,
    channel: "dry_run",
  };

  try {
    const { websiteId, websiteTitle, userId, day, daysRemaining } = params;

    // 1. Determine alert title and message based on trial milestone
    let title = "";
    let message = "";
    let severity: "info" | "warning" | "critical" = "info";
    let eventType = `migration_trial_reminder_day_${day}`;

    if (day === 7) {
      title = `Migration Trial Ending Soon (${daysRemaining} Days Left)`;
      message = `Your 10-day migration trial for "${websiteTitle}" expires in ${daysRemaining} days. Upgrade to a paid plan to keep all temporary assets and connect a custom domain.`;
      severity = "info";
    } else if (day === 9) {
      title = `Action Required: 1 Day Left on Migration Trial`;
      message = `Your migration trial for "${websiteTitle}" expires tomorrow. Upgrade your plan today to prevent automatic deletion of temporary migration artifacts.`;
      severity = "warning";
    } else {
      title = `Migration Trial Expired: Temporary Artifacts Cleaned`;
      message = `Your 10-day migration trial for "${websiteTitle}" has expired without an active paid subscription. Temporary migration artifacts and unused storage assets have been automatically cleaned. Your website draft structure remains preserved.`;
      severity = "critical";
      eventType = "migration_trial_expired";
    }

    // 2. Fetch recipient email from user profile or subscription
    let recipientEmail: string | null = null;
    try {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", userId)
        .maybeSingle();

      if (userProfile && typeof userProfile.email === "string") {
        recipientEmail = userProfile.email;
      }
    } catch {
      // Fallback if profiles table is restricted
    }

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
      } catch {
        // Fallback
      }
    }

    result.recipient = recipientEmail || undefined;

    // 3. Create Dashboard Event in seo_monitoring_events
    try {
      const { error: dbEventErr } = await supabase
        .from("seo_monitoring_events")
        .insert({
          website_id: websiteId,
          user_id: userId,
          event_type: eventType,
          severity,
          title,
          message,
          metadata: {
            day_milestone: day,
            days_remaining: daysRemaining,
            website_title: websiteTitle,
            notified_at: new Date().toISOString(),
          },
          is_read: false,
        });

      if (!dbEventErr) {
        result.dashboardEventCreated = true;
      } else {
        console.warn(`[MIGRATION_NOTIFICATION] Failed to insert dashboard event: ${dbEventErr.message}`);
      }
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      console.warn(`[MIGRATION_NOTIFICATION] Dashboard notification insert error: ${msg}`);
    }

    // 4. Outbound Email Dispatch
    const featureEnabled = process.env.FEATURE_OUTBOUND_ALERTS === "true";
    const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY;

    if (!recipientEmail || !featureEnabled || !apiKey) {
      console.log(
        `[MIGRATION_TRIAL_ALERT_DRY_RUN] Day=${day} recipient=${recipientEmail || "none"} websiteId=${websiteId} title="${title}"`
      );
      result.channel = "dry_run";
      result.emailSent = false;
      return result;
    }

    // Send email via Resend
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
          subject: `[Codeaxys] ${title}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: ${severity === "critical" ? "#e11d48" : severity === "warning" ? "#d97706" : "#2563eb"}; margin-top: 0;">${title}</h2>
              <p style="font-size: 15px; line-height: 1.6; color: #334155;">${message}</p>
              <div style="margin: 24px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://codeaxys.com"}/dashboard/websites/${websiteId}" 
                   style="background-color: #4f46e5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                  View Migrated Website
                </a>
              </div>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Codeaxys Automated Website Builder Lifecycle Management</p>
            </div>
          `,
        }),
      });

      if (response.ok) {
        result.emailSent = true;
        result.channel = "email";
      } else {
        const errText = await response.text().catch(() => "");
        console.warn(`[MIGRATION_NOTIFICATION] Resend dispatch HTTP ${response.status}: ${errText}`);
        result.error = `HTTP ${response.status}`;
      }
    }

    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[MIGRATION_NOTIFICATION_ERROR]", msg);
    result.error = msg;
    return result;
  }
}
