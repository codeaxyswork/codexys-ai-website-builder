import crypto from "crypto";
import { createAdminClient, loadMetaConnection } from "./meta-client";

export interface NormalizedLead {
  website_id: string;
  user_id: string;
  source: "website" | "meta" | "google_ads";
  source_lead_id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  campaign_id?: string | null;
  campaign_name?: string | null;
  adset_id?: string | null;
  adset_name?: string | null;
  ad_id?: string | null;
  ad_name?: string | null;
  landing_page?: string | null;
  form_id?: string | null;
  form_name?: string | null;
  status: "new" | "contacted" | "qualified" | "follow_up" | "converted" | "lost";
  notes?: string | null;
  metadata?: Record<string, any>;
}

export function sanitizeText(val: any): string | null {
  if (!val || typeof val !== "string") return null;
  const cleaned = val.trim();
  return cleaned.length > 0 ? cleaned.slice(0, 1000) : null;
}

export function validateEmail(email: any): string | null {
  const clean = sanitizeText(email);
  if (!clean) return null;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(clean) ? clean.toLowerCase() : null;
}

/**
 * Rapid double-submission protection hash for website form submissions
 */
export function generateWebsiteLeadId(websiteId: string, email?: string | null, phone?: string | null): string {
  const timeMinute = Math.floor(Date.now() / (60 * 1000));
  const rawStr = `${websiteId}:${email || ""}:${phone || ""}:${timeMinute}`;
  return `web_lead_${crypto.createHash("sha256").update(rawStr).digest("hex").slice(0, 16)}`;
}

/**
 * Normalize website lead submission payload
 */
export function normalizeWebsiteLead(
  websiteId: string,
  userId: string,
  payload: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    landingPage?: string;
    formId?: string;
    formName?: string;
  }
): NormalizedLead {
  const name = sanitizeText(payload.name);
  const email = validateEmail(payload.email);
  const phone = sanitizeText(payload.phone);
  const message = sanitizeText(payload.message);
  const landingPage = sanitizeText(payload.landingPage);
  const formId = sanitizeText(payload.formId);
  const formName = sanitizeText(payload.formName);

  const sourceLeadId = generateWebsiteLeadId(websiteId, email, phone);

  return {
    website_id: websiteId,
    user_id: userId,
    source: "website",
    source_lead_id: sourceLeadId,
    name,
    email,
    phone,
    message,
    landing_page: landingPage,
    form_id: formId,
    form_name: formName,
    status: "new",
    notes: null,
    metadata: {},
  };
}

/**
 * Resolve Meta campaign attribution against marketing_campaign_executions
 */
export async function resolveMetaCampaignAttribution(
  supabase: any,
  websiteId: string,
  attribution: { adId?: string | null; adsetId?: string | null; campaignId?: string | null }
): Promise<{ campaignId: string | null; campaignName: string | null }> {
  try {
    if (!attribution.adId && !attribution.adsetId && !attribution.campaignId) {
      return { campaignId: null, campaignName: null };
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

    const conditions: string[] = [];
    if (attribution.adId) conditions.push(`meta_ad_id.eq.${attribution.adId}`);
    if (attribution.adsetId) conditions.push(`meta_adset_id.eq.${attribution.adsetId}`);
    if (attribution.campaignId) conditions.push(`meta_campaign_id.eq.${attribution.campaignId}`);

    const { data: match } = await dbClient
      .from("marketing_campaign_executions")
      .select("id, approval_snapshot")
      .eq("website_id", websiteId)
      .or(conditions.join(","))
      .limit(1)
      .maybeSingle();

    if (match) {
      const snap = match.approval_snapshot || {};
      const campaignName = snap.campaignName || snap.title || snap.name || "Meta Campaign Execution";
      return { campaignId: match.id, campaignName };
    }
  } catch (err) {
    console.warn("Failed to resolve campaign attribution:", err);
  }
  return { campaignId: null, campaignName: null };
}

/**
 * Normalize Meta leadgen field data array into a predictable internal lead structure
 */
export function normalizeMetaLead(
  websiteId: string,
  userId: string,
  leadgenId: string,
  fieldData: Array<{ name: string; values: string[] }>,
  attribution: {
    campaignId?: string | null;
    campaignName?: string | null;
    adsetId?: string | null;
    adsetName?: string | null;
    adId?: string | null;
    adName?: string | null;
    formId?: string | null;
  }
): NormalizedLead {
  let name: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;
  let message: string | null = null;
  let company: string | null = null;
  let jobTitle: string | null = null;
  let city: string | null = null;
  let state: string | null = null;
  let country: string | null = null;

  const customFields: Record<string, string> = {};

  if (Array.isArray(fieldData)) {
    for (const item of fieldData) {
      if (!item || !item.name || !Array.isArray(item.values)) continue;
      const rawKey = item.name;
      const fieldKey = rawKey.toLowerCase();
      const val = (item.values[0] || "").trim();
      if (!val) continue;

      if (fieldKey === "full_name" || fieldKey === "name") {
        if (!name) name = sanitizeText(val);
      } else if (fieldKey === "first_name" || fieldKey === "firstname" || fieldKey === "given_name") {
        if (!firstName) firstName = sanitizeText(val);
      } else if (fieldKey === "last_name" || fieldKey === "lastname" || fieldKey === "surname" || fieldKey === "family_name") {
        if (!lastName) lastName = sanitizeText(val);
      } else if (fieldKey.includes("email")) {
        if (!email) email = validateEmail(val);
      } else if (fieldKey.includes("phone") || fieldKey.includes("mobile") || fieldKey.includes("contact_number")) {
        if (!phone) phone = sanitizeText(val);
      } else if (fieldKey.includes("message") || fieldKey.includes("note") || fieldKey.includes("comment") || fieldKey.includes("question")) {
        if (!message) message = sanitizeText(val);
      } else if (fieldKey.includes("company") || fieldKey.includes("business_name") || fieldKey.includes("organization")) {
        if (!company) company = sanitizeText(val);
      } else if (fieldKey.includes("job_title") || fieldKey.includes("title") || fieldKey.includes("position") || fieldKey.includes("role")) {
        if (!jobTitle) jobTitle = sanitizeText(val);
      } else if (fieldKey === "city" || fieldKey === "town") {
        if (!city) city = sanitizeText(val);
      } else if (fieldKey === "state" || fieldKey === "province" || fieldKey === "region") {
        if (!state) state = sanitizeText(val);
      } else if (fieldKey === "country") {
        if (!country) country = sanitizeText(val);
      } else {
        customFields[rawKey] = val;
      }
    }
  }

  // Construct full name if full_name was not explicitly set but first/last names exist
  if (!name) {
    if (firstName && lastName) {
      name = `${firstName} ${lastName}`;
    } else if (firstName) {
      name = firstName;
    } else if (lastName) {
      name = lastName;
    }
  }

  return {
    website_id: websiteId,
    user_id: userId,
    source: "meta",
    source_lead_id: leadgenId,
    name,
    email,
    phone,
    message,
    campaign_id: attribution.campaignId || null,
    campaign_name: attribution.campaignName || null,
    adset_id: attribution.adsetId || null,
    adset_name: attribution.adsetName || null,
    ad_id: attribution.adId || null,
    ad_name: attribution.adName || null,
    form_id: attribution.formId || null,
    form_name: "Meta Lead Instant Form",
    status: "new",
    notes: null,
    metadata: {
      first_name: firstName,
      last_name: lastName,
      company,
      job_title: jobTitle,
      city,
      state,
      country,
      custom_fields: customFields,
      raw_field_data: fieldData || [],
    },
  };
}

/**
 * Persist website lead into database
 */
export async function persistWebsiteLead(
  supabase: any,
  websiteId: string,
  payload: any
): Promise<any> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

  // 1. Resolve user ownership from websites table
  const { data: website, error: siteErr } = await dbClient
    .from("websites")
    .select("id, user_id")
    .eq("id", websiteId)
    .single();

  if (siteErr || !website) {
    throw new Error("Website not found.");
  }

  const normalized = normalizeWebsiteLead(websiteId, website.user_id, payload);

  const { data, error } = await dbClient
    .from("marketing_leads")
    .upsert(normalized, { onConflict: "website_id,source,source_lead_id" })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to persist website lead:", error);
    throw new Error(`Failed to store website lead: ${error.message}`);
  }

  return data;
}

/**
 * Resolve Meta Page mapping to Codeaxys website and user
 */
export async function resolveMetaPageMapping(
  supabase: any,
  pageId: string
): Promise<{ websiteId: string; userId: string } | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

  const { data: pageRow, error } = await dbClient
    .from("marketing_pages")
    .select("website_id, user_id")
    .eq("meta_page_id", pageId)
    .limit(1)
    .maybeSingle();

  if (error || !pageRow) {
    return null;
  }

  return { websiteId: pageRow.website_id, userId: pageRow.user_id };
}

/**
 * Retrieve Meta lead details using Meta Graph API
 */
export async function retrieveMetaLeadDetails(
  accessToken: string,
  leadgenId: string
): Promise<Array<{ name: string; values: string[] }>> {
  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(leadgenId)}?fields=field_data,created_time&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("Meta Graph API retrieveLeadDetails Error:", errData);
    throw new Error(errData.error?.message || "Failed to retrieve Meta lead details.");
  }

  const json = await res.json();
  return json.field_data || [];
}

/**
 * Persist Meta lead into database with campaign attribution
 */
export async function persistMetaLead(
  supabase: any,
  websiteId: string,
  userId: string,
  leadgenId: string,
  fieldData: Array<{ name: string; values: string[] }>,
  attribution: {
    campaignId?: string | null;
    campaignName?: string | null;
    adsetId?: string | null;
    adsetName?: string | null;
    adId?: string | null;
    adName?: string | null;
    formId?: string | null;
  }
): Promise<any> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

  const normalized = normalizeMetaLead(websiteId, userId, leadgenId, fieldData, attribution);

  const { data, error } = await dbClient
    .from("marketing_leads")
    .upsert(normalized, { onConflict: "website_id,source,source_lead_id" })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to persist Meta lead:", error);
    throw new Error(`Failed to store Meta lead: ${error.message}`);
  }

  return data;
}

/**
 * Log raw Meta webhook event for auditability
 */
export async function logWebhookEvent(
  supabase: any,
  provider: string,
  eventType: string,
  payloadHash: string,
  rawPayload: any,
  status: "processed" | "failed" | "dropped",
  errorMessage?: string | null
): Promise<void> {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

    await dbClient.from("marketing_webhook_events").insert({
      provider,
      event_type: eventType,
      payload_hash: payloadHash,
      raw_payload: rawPayload || {},
      status,
      error_message: errorMessage || null,
      processed_at: status === "processed" ? new Date().toISOString() : null,
    });
  } catch (err) {
    console.warn("Failed to log webhook event:", err);
  }
}
