import { MonitoringAlertInput } from "../seo-monitoring-engine";

export interface NotificationDispatchResult {
  sent: boolean;
  channel: "email" | "slack" | "dry_run";
  recipient?: string;
  reason?: string;
}

/**
 * Non-blocking failure-isolated outbound email alert dispatcher.
 * Safely handles missing API keys, feature flags, and network failures
 * without throwing errors or breaking core background monitoring.
 */
export async function dispatchEmailAlert(
  supabase: any,
  alert: MonitoringAlertInput
): Promise<NotificationDispatchResult> {
  try {
    const featureEnabled = process.env.FEATURE_OUTBOUND_ALERTS === "true";
    const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY;

    // Fetch recipient email (from subscription table or user profile)
    let recipientEmail: string | null = null;
    try {
      const { data: sub } = await supabase
        .from("seo_alert_subscriptions")
        .select("email")
        .eq("website_id", alert.website_id)
        .eq("enabled", true)
        .maybeSingle();

      if (sub?.email) {
        recipientEmail = sub.email;
      }
    } catch (e) {
      // Table may not exist yet, fallback to user profile
    }

    if (!recipientEmail) {
      try {
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", alert.user_id)
          .maybeSingle();
        recipientEmail = userProfile?.email || null;
      } catch (e) {}
    }

    if (!recipientEmail) {
      return { sent: false, channel: "email", reason: "No recipient email found" };
    }

    // DRY-RUN MODE: If feature flag is off or API key is unconfigured, log dry-run safely
    if (!featureEnabled || !apiKey) {
      console.log(
        `[OUTBOUND_ALERT_DRY_RUN] event=${alert.event_type} severity=${alert.severity} recipient=${recipientEmail} title="${alert.title}"`
      );
      return {
        sent: false,
        channel: "dry_run",
        recipient: recipientEmail,
        reason: !featureEnabled ? "FEATURE_OUTBOUND_ALERTS is false" : "Missing API Key",
      };
    }

    // Real Email Dispatch (Resend API)
    if (process.env.RESEND_API_KEY) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.ALERT_SENDER_EMAIL || "SEO Monitoring <alerts@codeaxys.com>",
          to: [recipientEmail],
          subject: `[Codeaxys SEO Alert] ${alert.title}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
              <h2 style="color: ${alert.severity === "critical" ? "#e11d48" : "#d97706"};">${alert.title}</h2>
              <p style="font-size: 14px; line-height: 1.6;">${alert.message}</p>
              ${alert.affected_page ? `<p><strong>Affected Page:</strong> <code>${alert.affected_page}</code></p>` : ""}
              ${alert.previous_value ? `<p><strong>Previous Value:</strong> ${alert.previous_value}</p>` : ""}
              ${alert.current_value ? `<p><strong>Current Value:</strong> ${alert.current_value}</p>` : ""}
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #64748b;">Codeaxys Automated SEO Monitoring System</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error(`Resend API dispatch error (${response.status}):`, errText);
        return { sent: false, channel: "email", recipient: recipientEmail, reason: `HTTP ${response.status}` };
      }

      return { sent: true, channel: "email", recipient: recipientEmail };
    }

    return { sent: false, channel: "email", recipient: recipientEmail, reason: "No active email transport" };
  } catch (err: any) {
    console.error("Non-blocking email dispatch failure:", err?.message || err);
    return { sent: false, channel: "email", reason: err?.message || "Unknown error" };
  }
}
