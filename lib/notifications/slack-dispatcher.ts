import { MonitoringAlertInput } from "../seo-monitoring-engine";

export interface SlackDispatchResult {
  sent: boolean;
  channel: "slack" | "dry_run";
  reason?: string;
}

/**
 * Non-blocking failure-isolated Slack webhook alert dispatcher.
 * Handles missing webhooks and network errors safely without breaking monitoring jobs.
 */
export async function dispatchSlackAlert(
  supabase: any,
  alert: MonitoringAlertInput
): Promise<SlackDispatchResult> {
  try {
    const featureEnabled = process.env.FEATURE_OUTBOUND_ALERTS === "true";

    let webhookUrl: string | null = null;
    try {
      const { data: sub } = await supabase
        .from("seo_alert_subscriptions")
        .select("webhook_url")
        .eq("website_id", alert.website_id)
        .eq("enabled", true)
        .maybeSingle();

      if (sub?.webhook_url) {
        webhookUrl = sub.webhook_url;
      }
    } catch (e) {
      // Table may not exist yet
    }

    if (!webhookUrl) {
      webhookUrl = process.env.SLACK_ALERT_WEBHOOK_URL || null;
    }

    if (!webhookUrl) {
      return { sent: false, channel: "slack", reason: "No webhook URL configured" };
    }

    if (!featureEnabled) {
      console.log(
        `[SLACK_ALERT_DRY_RUN] event=${alert.event_type} severity=${alert.severity} title="${alert.title}"`
      );
      return { sent: false, channel: "dry_run", reason: "FEATURE_OUTBOUND_ALERTS is false" };
    }

    const payload = {
      text: `*Codeaxys SEO Alert*: ${alert.title}`,
      attachments: [
        {
          color: alert.severity === "critical" ? "#e11d48" : "#d97706",
          fields: [
            { title: "Severity", value: alert.severity.toUpperCase(), short: true },
            { title: "Event", value: alert.event_type, short: true },
            { title: "Message", value: alert.message, short: false },
            ...(alert.affected_page ? [{ title: "Affected Page", value: alert.affected_page, short: true }] : []),
            ...(alert.previous_value ? [{ title: "Previous", value: alert.previous_value, short: true }] : []),
            ...(alert.current_value ? [{ title: "Current", value: alert.current_value, short: true }] : []),
          ],
          footer: "Codeaxys SEO Monitoring",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Slack webhook error (${response.status})`);
      return { sent: false, channel: "slack", reason: `HTTP ${response.status}` };
    }

    return { sent: true, channel: "slack" };
  } catch (err: any) {
    console.error("Non-blocking Slack dispatch failure:", err?.message || err);
    return { sent: false, channel: "slack", reason: err?.message || "Unknown error" };
  }
}
