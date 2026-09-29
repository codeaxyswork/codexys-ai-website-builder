import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient, loadMetaConnection } from "@/lib/marketing/meta-client";
import {
  resolveMetaPageMapping,
  retrieveMetaLeadDetails,
  persistMetaLead,
  logWebhookEvent,
  resolveMetaCampaignAttribution,
} from "@/lib/marketing/lead-engine";

/**
 * GET /api/webhooks/meta — Meta Webhook Verification Handshake
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedVerifyToken =
    process.env.META_WEBHOOK_VERIFY_TOKEN ||
    process.env.META_VERIFY_TOKEN ||
    "codeaxys-meta-webhook-verify-token-secret";

  if (mode === "subscribe" && token === expectedVerifyToken && challenge) {
    console.log("Meta Webhook Verification Succeeded!");
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("Meta Webhook Verification Failed: Invalid token or mode.");
  return new Response("Forbidden: Invalid verification token.", { status: 403 });
}

/**
 * POST /api/webhooks/meta — Real-time Meta Lead Event Receiver
 */
export async function POST(req: NextRequest) {
  try {
    const rawText = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256") || req.headers.get("X-Hub-Signature-256");

    const appSecret = (
      process.env.META_CLIENT_SECRET ||
      process.env.META_APP_SECRET ||
      ""
    ).trim();

    // 1. Verify HMAC SHA-256 signature
    if (appSecret) {
      if (!signatureHeader) {
        console.error("Meta Webhook Signature Missing! Request rejected.");
        return NextResponse.json({ error: "Missing x-hub-signature-256 header." }, { status: 401 });
      }

      const hmac = crypto.createHmac("sha256", appSecret).update(rawText).digest("hex");
      const expectedSig = `sha256=${hmac}`;

      const sigBuffer = Buffer.from(signatureHeader);
      const expectedBuffer = Buffer.from(expectedSig);

      if (
        sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        console.error("Meta Webhook Signature Verification Failed! Potential tampered request.");
        return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
      }
    } else if (signatureHeader) {
      // Signature header provided without configured secret — log warning
      console.warn("Meta Webhook signature header provided, but META_CLIENT_SECRET is unset.");
    }

    const payloadHash = crypto.createHash("sha256").update(rawText).digest("hex");
    const json = JSON.parse(rawText || "{}");
    const dbClient = createAdminClient();

    if (json.object !== "page" || !Array.isArray(json.entry)) {
      await logWebhookEvent(dbClient, "meta", "unknown", payloadHash, json, "dropped", "Non-page object event");
      return NextResponse.json({ success: true, message: "Ignored non-page webhook event." });
    }

    let processedCount = 0;

    for (const entry of json.entry) {
      const pageId = entry.id;
      const changes = Array.isArray(entry.changes) ? entry.changes : [];

      for (const change of changes) {
        if (change.field !== "leadgen" || !change.value) continue;

        const leadVal = change.value;
        const leadgenId = leadVal.leadgen_id;
        const adId = leadVal.ad_id;
        const adsetId = leadVal.adset_id;
        const formId = leadVal.form_id;

        // 2. Resolve Facebook Page mapping to Codeaxys website & user
        const mapping = await resolveMetaPageMapping(dbClient, pageId || leadVal.page_id);
        if (!mapping) {
          console.warn(`Unmapped Facebook Page ID ${pageId || leadVal.page_id} received in webhook. Event dropped.`);
          await logWebhookEvent(
            dbClient,
            "meta",
            "leadgen",
            payloadHash,
            { pageId, leadgenId },
            "dropped",
            "Facebook Page not mapped to an active Codeaxys website"
          );
          continue;
        }

        // 3. Load decrypted Meta access token for website
        const connection = await loadMetaConnection(dbClient, mapping.websiteId);
        if (!connection || !connection.access_token) {
          console.warn(`Missing or invalid Meta access token for website ${mapping.websiteId}. Event logged as failed.`);
          await logWebhookEvent(
            dbClient,
            "meta",
            "leadgen",
            payloadHash,
            { pageId, leadgenId },
            "failed",
            "Meta access token missing or expired"
          );
          continue;
        }

        // 4. Retrieve full lead field data from Meta Graph API
        let fieldData: Array<{ name: string; values: string[] }> = [];
        try {
          fieldData = await retrieveMetaLeadDetails(connection.access_token, leadgenId);
        } catch (fetchErr: any) {
          console.error(`Failed to retrieve Meta lead details for leadgen_id ${leadgenId}:`, fetchErr);
          await logWebhookEvent(
            dbClient,
            "meta",
            "leadgen",
            payloadHash,
            { pageId, leadgenId },
            "failed",
            fetchErr?.message || "Graph API lead retrieval failed"
          );
          continue;
        }

        // 4.5 Resolve campaign attribution from marketing_campaign_executions if available
        const campaignAttr = await resolveMetaCampaignAttribution(dbClient, mapping.websiteId, {
          adId,
          adsetId,
          campaignId: leadVal.campaign_id,
        });

        // 5. Persist normalized lead into database with deduplication
        await persistMetaLead(dbClient, mapping.websiteId, mapping.userId, leadgenId, fieldData, {
          campaignId: campaignAttr.campaignId || leadVal.campaign_id || null,
          campaignName: campaignAttr.campaignName || null,
          adsetId: adsetId || null,
          adId: adId || null,
          formId: formId || null,
        });

        processedCount++;
        await logWebhookEvent(
          dbClient,
          "meta",
          "leadgen",
          payloadHash,
          { pageId, leadgenId, websiteId: mapping.websiteId },
          "processed",
          null
        );
      }
    }

    return NextResponse.json({ success: true, processedCount });
  } catch (err: any) {
    console.error("Meta Webhook Processing Error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error processing Meta webhook." }, { status: 500 });
  }
}
