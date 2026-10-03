import { loadMetaConnection, createAdminClient } from "./meta-client";

export interface ApprovalSnapshot {
  user_id: string;
  website_id: string;
  draft_id: string;
  approved_at: string;
  approved_by: string;
  budget: {
    dailyBudgetAmount: number;
    durationDays: number;
    totalBudgetAmount: number;
    currency: string;
  };
  targetAudience: {
    location?: string;
    ageRange?: { min?: number; max?: number } | string;
    gender?: string;
    interests?: string[];
    demographicsSummary?: string;
  };
  location: string;
  metaAdAccountId: string;
  metaPageId: string;
  selectedAdCopy: {
    headline: string;
    primaryText: string;
    description: string;
    cta: string;
  };
  selectedImage: {
    sourceUrl: string;
    assetId?: string;
    sourceType?: string;
  };
  landingPage: {
    path: string;
    url: string;
  };
  leadDestination: string;
  platform: string;
  objective: string;
  snapshotHash: string;
  creativeFormat?: "image" | "video" | "carousel";
  videoUrl?: string;
  carouselCards?: Array<{
    headline: string;
    description?: string;
    imageUrl: string;
    linkUrl?: string;
  }>;
}

export interface ExecutionRecord {
  id: string;
  draft_id: string;
  website_id: string;
  user_id: string;
  status: "approval_pending" | "approved" | "publishing" | "published" | "publish_failed" | "rejected" | "cancelled";
  idempotency_key: string;
  approval_snapshot: ApprovalSnapshot;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  meta_creative_id: string | null;
  meta_ad_id: string | null;
  publishing_step: string;
  execution_trace: any[];
  error_log: any[];
  created_at: string;
  updated_at: string;
}

function normalizeAdAccountId(id: string): string {
  const clean = id.trim();
  return clean.startsWith("act_") ? clean : `act_${clean}`;
}

function getGraphBaseUrl(): string {
  return "https://graph.facebook.com/v19.0";
}

function parseMetaGraphError(data: any, fallbackMessage: string): string {
  if (data?.error) {
    const err = data.error;
    const userMsg = err.error_user_msg;
    const userTitle = err.error_user_title;
    const msg = err.message;
    const subcode = err.error_subcode ? ` (Subcode: ${err.error_subcode})` : "";
    const traceId = err.fbtrace_id ? ` [trace: ${err.fbtrace_id}]` : "";

    if (userMsg && userTitle) {
      return `${userTitle}: ${userMsg}${subcode}`;
    }
    if (userMsg) {
      return `${userMsg}${subcode}`;
    }
    if (userTitle) {
      return `${userTitle}${subcode}`;
    }
    if (msg && msg !== "Invalid parameter") {
      return `${msg}${subcode}${traceId}`;
    }
    if (msg === "Invalid parameter" && (err.code || err.error_subcode)) {
      return `Meta API Parameter Error: Invalid parameter${subcode}${traceId}`;
    }
    return msg || fallbackMessage;
  }
  return fallbackMessage;
}

/**
 * Step 1: Create Meta Campaign (PAUSED)
 */
export async function createMetaCampaign(
  accessToken: string,
  adAccountId: string,
  snapshot: ApprovalSnapshot,
  executionId: string
): Promise<string> {
  const actId = normalizeAdAccountId(adAccountId);
  const url = `${getGraphBaseUrl()}/${actId}/campaigns`;

  const validObjective = snapshot.objective === "OUTCOME_TRAFFIC"
    ? "OUTCOME_TRAFFIC"
    : snapshot.objective === "OUTCOME_SALES"
    ? "OUTCOME_SALES"
    : "OUTCOME_LEADS";

  const campaignName = `Codeaxys - ${snapshot.selectedAdCopy.headline.slice(0, 30)} - ${executionId.slice(0, 8)}`;

  const bodyParams = new URLSearchParams({
    name: campaignName,
    objective: validObjective,
    status: "PAUSED", // STRICT SAFETY: Always PAUSED
    special_ad_categories: JSON.stringify([]),
    is_adset_budget_sharing_enabled: "false", // Mandatory for ad set level budgets on Graph API v19+
    access_token: accessToken,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: bodyParams.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Meta Campaign Creation Failed:", data);
    throw new Error(parseMetaGraphError(data, "Failed to create Meta campaign."));
  }

  return data.id;
}

/**
 * Step 2: Create Meta Ad Set (PAUSED)
 */
export async function createMetaAdSet(
  accessToken: string,
  adAccountId: string,
  campaignId: string,
  snapshot: ApprovalSnapshot
): Promise<string> {
  const actId = normalizeAdAccountId(adAccountId);
  const url = `${getGraphBaseUrl()}/${actId}/adsets`;

  // Daily budget in paise/cents (integer)
  const budgetInSubunits = Math.round(snapshot.budget.dailyBudgetAmount * 100);
  if (isNaN(budgetInSubunits) || budgetInSubunits < 100) {
    throw new Error("Invalid budget amount for Meta Ad Set.");
  }

  const optGoal = snapshot.objective === "OUTCOME_TRAFFIC"
    ? "LINK_CLICKS"
    : snapshot.objective === "OUTCOME_SALES"
    ? "OFFSITE_CONVERSIONS"
    : "LEAD_GENERATION";

  const targetingSpec: any = {
    geo_locations: {
      countries: ["IN"],
    },
    age_min: 18,
    age_max: 65,
  };

  const adSetName = `AdSet - ${snapshot.location || "Target Location"} - ${snapshot.budget.dailyBudgetAmount}/day`;

  const bodyParams = new URLSearchParams({
    name: adSetName,
    campaign_id: campaignId,
    daily_budget: budgetInSubunits.toString(),
    billing_event: "IMPRESSIONS",
    optimization_goal: optGoal,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: JSON.stringify(targetingSpec),
    promoted_object: JSON.stringify({ page_id: snapshot.metaPageId }),
    status: "PAUSED", // STRICT SAFETY: Always PAUSED
    access_token: accessToken,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: bodyParams.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Meta AdSet Creation Failed:", data);
    throw new Error(parseMetaGraphError(data, "Failed to create Meta ad set."));
  }

  return data.id;
}

/**
 * Step 3: Upload Image / Get Image Hash from Meta
 */
export async function uploadMetaAdImage(
  accessToken: string,
  adAccountId: string,
  imageUrl: string
): Promise<string | null> {
  if (!imageUrl || !imageUrl.startsWith("http")) {
    return null;
  }

  const actId = normalizeAdAccountId(adAccountId);
  const url = `${getGraphBaseUrl()}/${actId}/adimages`;

  try {
    const bodyParams = new URLSearchParams({
      url: imageUrl,
      access_token: accessToken,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: bodyParams.toString(),
    });

    const data = await res.json();
    if (res.ok && data.images) {
      const keys = Object.keys(data.images);
      if (keys.length > 0 && data.images[keys[0]]?.hash) {
        return data.images[keys[0]].hash;
      }
    }
  } catch (err) {
    console.warn("Meta Image Upload Warning (proceeding with fallback URL):", err);
  }

  return null;
}

/**
 * Normalizes human-readable CTA labels into valid Meta Graph API Call-To-Action enum strings
 */
export function normalizeMetaCtaType(ctaInput?: string | null): string {
  if (!ctaInput) return "LEARN_MORE";

  const clean = ctaInput.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  // Explicit mapping table for human-readable UI labels & common variations
  const explicitMapping: Record<string, string> = {
    "BOOK_NOW": "BOOK_NOW",
    "BOOK_CONSULTATION": "BOOK_A_CONSULTATION",
    "BOOK_A_CONSULTATION": "BOOK_A_CONSULTATION",
    "LEARN_MORE": "LEARN_MORE",
    "SIGN_UP": "SIGN_UP",
    "APPLY_NOW": "APPLY_NOW",
    "CONTACT_US": "CONTACT_US",
    "GET_QUOTE": "GET_QUOTE",
    "GET_A_QUOTE": "GET_QUOTE",
    "MAKE_AN_APPOINTMENT": "MAKE_AN_APPOINTMENT",
    "MAKE_APPOINTMENT": "MAKE_AN_APPOINTMENT",
    "ASK_ABOUT_SERVICES": "ASK_ABOUT_SERVICES",
    "INQUIRE_NOW": "INQUIRE_NOW",
    "SHOP_NOW": "SHOP_NOW",
    "DOWNLOAD": "DOWNLOAD",
    "GET_OFFER": "GET_OFFER",
    "SUBSCRIBE": "SUBSCRIBE",
    "BOOK_TRAVEL": "BOOK_TRAVEL",
    "BUY_NOW": "BUY_NOW",
    "CALL_NOW": "CALL_NOW",
    "CHAT_NOW": "CHAT_NOW",
    "ORDER_NOW": "ORDER_NOW",
    "SEE_MORE": "SEE_MORE",
    "WATCH_MORE": "WATCH_MORE",
  };

  if (explicitMapping[clean]) {
    return explicitMapping[clean];
  }

  const validMetaCtas = new Set([
    "BOOK_TRAVEL", "CONTACT_US", "DONATE", "DONATE_NOW", "DOWNLOAD", "GET_DIRECTIONS", "GO_LIVE",
    "INTERESTED", "LEARN_MORE", "SEE_DETAILS", "LIKE_PAGE", "MESSAGE_PAGE", "RAISE_MONEY", "SAVE",
    "SEND_TIP", "SHOP_NOW", "SIGN_UP", "VIEW_INSTAGRAM_PROFILE", "INSTAGRAM_MESSAGE", "LOYALTY_LEARN_MORE",
    "PURCHASE_GIFT_CARDS", "PAY_TO_ACCESS", "SEE_MORE", "TRY_IN_CAMERA", "WHATSAPP_LINK", "GET_IN_TOUCH",
    "TRY_NOW", "ASK_A_QUESTION", "START_A_CHAT", "CHAT_NOW", "ASK_US", "CHAT_WITH_US", "SHOP_ON_RETAILER",
    "BOOK_NOW", "CHECK_AVAILABILITY", "ORDER_NOW", "WHATSAPP_MESSAGE", "GET_MOBILE_APP", "INSTALL_MOBILE_APP",
    "USE_MOBILE_APP", "INSTALL_APP", "USE_APP", "PLAY_GAME", "TRY_DEMO", "WATCH_VIDEO", "WATCH_MORE",
    "OPEN_LINK", "NO_BUTTON", "LISTEN_MUSIC", "MOBILE_DOWNLOAD", "GET_OFFER", "GET_OFFER_VIEW", "BUY_NOW",
    "BUY_TICKETS", "UPDATE_APP", "BET_NOW", "ADD_TO_CART", "SELL_NOW", "GET_SHOWTIMES", "LISTEN_NOW",
    "GET_EVENT_TICKETS", "REMIND_ME", "SEARCH_MORE", "PRE_REGISTER", "SWIPE_UP_PRODUCT", "SWIPE_UP_SHOP",
    "PLAY_GAME_ON_FACEBOOK", "VISIT_WORLD", "OPEN_INSTANT_APP", "JOIN_GROUP", "GET_PROMOTIONS", "SEND_UPDATES",
    "INQUIRE_NOW", "VISIT_PROFILE", "CHAT_ON_WHATSAPP", "EXPLORE_MORE", "CONFIRM", "JOIN_CHANNEL",
    "MAKE_AN_APPOINTMENT", "ASK_ABOUT_SERVICES", "BOOK_A_CONSULTATION", "GET_A_QUOTE", "BUY_VIA_MESSAGE",
    "ASK_FOR_MORE_INFO", "VIEW_PRODUCT", "VIEW_CHANNEL", "WATCH_LIVE_VIDEO", "JOIN_LIVE_VIDEO", "IMAGINE",
    "WATCH_NOW", "STREAM_NOW", "CALL", "MISSED_CALL", "CALL_NOW", "CALL_ME", "APPLY_NOW", "BUY",
    "GET_QUOTE", "SUBSCRIBE", "RECORD_NOW", "VOTE_NOW", "GIVE_FREE_RIDES", "REGISTER_NOW", "OPEN_MESSENGER_EXT",
    "EVENT_RSVP", "CIVIC_ACTION", "SEND_INVITES", "REFER_FRIENDS", "REQUEST_TIME", "SEE_MENU", "SEARCH",
    "TRY_IT", "TRY_ON", "LINK_CARD", "DIAL_CODE", "FIND_YOUR_GROUPS", "START_ORDER"
  ]);

  if (validMetaCtas.has(clean)) {
    return clean;
  }

  return "LEARN_MORE";
}

/**
 * Centralized resolver for authoritative public production website URL.
 * Priority:
 *   a. Valid website.custom_domain or website.domain
 *   b. If website.is_published === true and published_slug exists:
 *      https://codeaxys.com/site/{published_slug}
 *   c. Otherwise returns null.
 */
export function getProductionWebsiteUrl(website?: {
  is_published?: boolean | null;
  published_slug?: string | null;
  custom_domain?: string | null;
  domain?: string | null;
} | null): string | null {
  if (!website) return null;

  const custom = (website.custom_domain || website.domain || "").trim().toLowerCase();
  if (custom && !custom.includes("localhost") && !custom.includes("website.com") && !custom.includes("example.com")) {
    const cleanDomain = custom.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").trim();
    if (cleanDomain) {
      return `https://${cleanDomain}`;
    }
  }

  const slug = (website.published_slug || "").trim().toLowerCase();
  if (website.is_published && slug) {
    const rawAppDomain = (
      process.env.APP_DOMAIN ||
      process.env.NEXT_PUBLIC_APP_DOMAIN ||
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
      "codeaxys.com"
    ).trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");

    const cleanAppDomain = (rawAppDomain && !rawAppDomain.includes("localhost")) ? rawAppDomain : "codeaxys.com";
    return `https://${slug}.${cleanAppDomain}`;
  }

  return null;
}

/**
 * Validates that a destination URL is a valid, non-placeholder, absolute HTTPS production URL.
 * Throws a user-friendly error if invalid or unavailable.
 */
export function validateProductionUrl(urlInput?: string | null): string {
  const fallbackError = "This website is not published or does not have a valid production URL. Publish or connect the client's website before creating the Meta campaign.";

  if (!urlInput || typeof urlInput !== "string") {
    throw new Error(fallbackError);
  }

  const clean = urlInput.trim();
  if (!clean || !clean.startsWith("https://")) {
    throw new Error(fallbackError);
  }

  const lower = clean.toLowerCase();
  const invalidPatterns = [
    "localhost",
    "127.0.0.1",
    "website.com",
    "example.com",
    "test.com",
    "dummy.com",
    "placeholder.com",
  ];

  for (const pattern of invalidPatterns) {
    if (lower.includes(pattern)) {
      throw new Error(fallbackError);
    }
  }

  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.hostname.split(".").length < 2) {
      throw new Error(fallbackError);
    }
  } catch {
    throw new Error(fallbackError);
  }

  return clean;
}

/**
 * Step 3.5: Upload Video / Get Video ID from Meta (/advideos)
 */
export async function uploadMetaAdVideo(
  accessToken: string,
  adAccountId: string,
  videoUrl: string
): Promise<string | null> {
  if (!videoUrl || !videoUrl.startsWith("http")) {
    return null;
  }

  const actId = normalizeAdAccountId(adAccountId);
  const url = `${getGraphBaseUrl()}/${actId}/advideos`;

  try {
    const bodyParams = new URLSearchParams({
      file_url: videoUrl,
      access_token: accessToken,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: bodyParams.toString(),
    });

    const data = await res.json();
    if (res.ok && data.id) {
      return data.id;
    }
  } catch (err) {
    console.warn("Meta Video Upload Warning (proceeding with video URL spec):", err);
  }

  return null;
}

/**
 * Step 4: Create Meta Ad Creative (Supports Single Image, Video & Carousel Formats)
 */
export async function createMetaAdCreative(
  accessToken: string,
  adAccountId: string,
  snapshot: ApprovalSnapshot,
  imageHash?: string | null
): Promise<string> {
  const actId = normalizeAdAccountId(adAccountId);
  const url = `${getGraphBaseUrl()}/${actId}/adcreatives`;

  // Strict HTTPS Production URL Guard (Enforces same validated URL for both link & CTA value link)
  const validProductionUrl = validateProductionUrl(snapshot.landingPage?.url);

  const format = snapshot.creativeFormat || (snapshot.videoUrl ? "video" : snapshot.carouselCards && snapshot.carouselCards.length > 1 ? "carousel" : "image");

  let creativeSpec: any;

  if (format === "video" && snapshot.videoUrl) {
    const videoId = await uploadMetaAdVideo(accessToken, adAccountId, snapshot.videoUrl);
    creativeSpec = {
      page_id: snapshot.metaPageId,
      video_data: {
        video_id: videoId || undefined,
        image_url: snapshot.selectedImage?.sourceUrl || undefined,
        message: snapshot.selectedAdCopy.primaryText,
        title: snapshot.selectedAdCopy.headline,
        call_to_action: {
          type: normalizeMetaCtaType(snapshot.selectedAdCopy.cta),
          value: { link: validProductionUrl },
        },
      },
    };
  } else if (format === "carousel" && snapshot.carouselCards && snapshot.carouselCards.length > 0) {
    const childAttachments = await Promise.all(
      snapshot.carouselCards.map(async (card) => {
        const cardHash = card.imageUrl ? await uploadMetaAdImage(accessToken, adAccountId, card.imageUrl) : null;
        return {
          link: card.linkUrl ? validateProductionUrl(card.linkUrl) : validProductionUrl,
          name: card.headline || snapshot.selectedAdCopy.headline,
          description: card.description || snapshot.selectedAdCopy.description,
          image_hash: cardHash || undefined,
          picture: cardHash ? undefined : card.imageUrl,
          call_to_action: {
            type: normalizeMetaCtaType(snapshot.selectedAdCopy.cta),
            value: { link: validProductionUrl },
          },
        };
      })
    );

    creativeSpec = {
      page_id: snapshot.metaPageId,
      link_data: {
        link: validProductionUrl,
        message: snapshot.selectedAdCopy.primaryText,
        child_attachments: childAttachments,
        call_to_action: {
          type: normalizeMetaCtaType(snapshot.selectedAdCopy.cta),
          value: { link: validProductionUrl },
        },
      },
    };
  } else {
    // Single Image Default Format
    const linkData: any = {
      link: validProductionUrl,
      message: snapshot.selectedAdCopy.primaryText,
      name: snapshot.selectedAdCopy.headline,
      description: snapshot.selectedAdCopy.description,
      call_to_action: {
        type: normalizeMetaCtaType(snapshot.selectedAdCopy.cta),
        value: { link: validProductionUrl },
      },
    };

    if (imageHash) {
      linkData.image_hash = imageHash;
    } else if (snapshot.selectedImage?.sourceUrl) {
      linkData.picture = snapshot.selectedImage.sourceUrl;
    }

    creativeSpec = {
      page_id: snapshot.metaPageId,
      link_data: linkData,
    };
  }

  const creativeName = `Creative - ${snapshot.selectedAdCopy.headline.slice(0, 30)}`;

  const bodyParams = new URLSearchParams({
    name: creativeName,
    object_story_spec: JSON.stringify(creativeSpec),
    access_token: accessToken,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: bodyParams.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Meta AdCreative Creation Failed:", data);
    throw new Error(parseMetaGraphError(data, "Failed to create Meta ad creative."));
  }

  return data.id;
}

/**
 * Step 5: Create Meta Ad (PAUSED)
 */
export async function createMetaAd(
  accessToken: string,
  adAccountId: string,
  adsetId: string,
  creativeId: string,
  snapshot: ApprovalSnapshot
): Promise<string> {
  const actId = normalizeAdAccountId(adAccountId);
  const url = `${getGraphBaseUrl()}/${actId}/ads`;

  const adName = `Ad - ${snapshot.selectedAdCopy.headline.slice(0, 30)}`;

  const bodyParams = new URLSearchParams({
    name: adName,
    adset_id: adsetId,
    creative: JSON.stringify({ creative_id: creativeId }),
    status: "PAUSED", // STRICT SAFETY: Always PAUSED
    access_token: accessToken,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: bodyParams.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Meta Ad Creation Failed:", data);
    throw new Error(parseMetaGraphError(data, "Failed to create Meta ad."));
  }

  return data.id;
}

/**
 * Main Sequential Publishing Machine with Step-by-Step ID Persistence & Partial Failure Recovery
 */
export async function executeMetaCampaignPublish(
  supabase: any,
  executionId: string,
  mockMode: boolean = false
): Promise<ExecutionRecord> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

  // 1. Fetch current execution record
  const { data: record, error: fetchErr } = await dbClient
    .from("marketing_campaign_executions")
    .select("*")
    .eq("id", executionId)
    .single();

  if (fetchErr || !record) {
    throw new Error("Execution record not found.");
  }

  if (record.status === "published") {
    return record as ExecutionRecord;
  }

  const snapshot: ApprovalSnapshot = record.approval_snapshot;
  const trace: any[] = record.execution_trace || [];
  const errors: any[] = record.error_log || [];

  // Update status to publishing
  await dbClient
    .from("marketing_campaign_executions")
    .update({
      status: "publishing",
      publishing_step: record.publishing_step || "validating",
      updated_at: new Date().toISOString(),
    })
    .eq("id", executionId);

  // Load Meta connection & decrypt token
  const connection = await loadMetaConnection(dbClient, record.website_id);
  if (!mockMode && (!connection || !connection.access_token || connection.status !== "connected")) {
    const errStr = "Connected Meta OAuth account is missing or requires re-authentication.";
    errors.push({ step: "auth", error: errStr, timestamp: new Date().toISOString() });
    await dbClient
      .from("marketing_campaign_executions")
      .update({
        status: "publish_failed",
        publishing_step: "auth_failed",
        error_log: errors,
        updated_at: new Date().toISOString(),
      })
      .eq("id", executionId);
    throw new Error(errStr);
  }

  const accessToken = connection?.access_token || "mock_token";
  const adAccountId = snapshot.metaAdAccountId;

  let campaignId = record.meta_campaign_id;
  let adsetId = record.meta_adset_id;
  let creativeId = record.meta_creative_id;
  let adId = record.meta_ad_id;

  try {
    // Pre-flight Production URL Guard: Ensure valid HTTPS production destination URL before executing any Meta API calls
    if (!mockMode) {
      validateProductionUrl(snapshot.landingPage?.url);
    }

    // STEP 1: Campaign Creation
    if (!campaignId) {
      trace.push({ step: "creating_campaign", timestamp: new Date().toISOString() });
      if (mockMode) {
        campaignId = `mock_camp_${Date.now()}`;
      } else {
        campaignId = await createMetaCampaign(accessToken, adAccountId, snapshot, executionId);
      }
      trace.push({ step: "campaign_created", campaignId, timestamp: new Date().toISOString() });

      await dbClient
        .from("marketing_campaign_executions")
        .update({
          meta_campaign_id: campaignId,
          publishing_step: "campaign_created",
          execution_trace: trace,
          updated_at: new Date().toISOString(),
        })
        .eq("id", executionId);
    }

    // STEP 2: Ad Set Creation
    if (!adsetId) {
      trace.push({ step: "creating_adset", timestamp: new Date().toISOString() });
      if (mockMode) {
        adsetId = `mock_adset_${Date.now()}`;
      } else {
        adsetId = await createMetaAdSet(accessToken, adAccountId, campaignId, snapshot);
      }
      trace.push({ step: "adset_created", adsetId, timestamp: new Date().toISOString() });

      await dbClient
        .from("marketing_campaign_executions")
        .update({
          meta_adset_id: adsetId,
          publishing_step: "adset_created",
          execution_trace: trace,
          updated_at: new Date().toISOString(),
        })
        .eq("id", executionId);
    }

    // STEP 3: Creative Creation
    if (!creativeId) {
      trace.push({ step: "creating_creative", timestamp: new Date().toISOString() });
      let imageHash: string | null = null;
      if (!mockMode && snapshot.selectedImage?.sourceUrl) {
        imageHash = await uploadMetaAdImage(accessToken, adAccountId, snapshot.selectedImage.sourceUrl);
      }

      if (mockMode) {
        creativeId = `mock_creative_${Date.now()}`;
      } else {
        creativeId = await createMetaAdCreative(accessToken, adAccountId, snapshot, imageHash);
      }
      trace.push({ step: "creative_created", creativeId, timestamp: new Date().toISOString() });

      await dbClient
        .from("marketing_campaign_executions")
        .update({
          meta_creative_id: creativeId,
          publishing_step: "creative_created",
          execution_trace: trace,
          updated_at: new Date().toISOString(),
        })
        .eq("id", executionId);
    }

    // STEP 4: Ad Creation
    if (!adId) {
      trace.push({ step: "creating_ad", timestamp: new Date().toISOString() });
      if (mockMode) {
        adId = `mock_ad_${Date.now()}`;
      } else {
        adId = await createMetaAd(accessToken, adAccountId, adsetId, creativeId, snapshot);
      }
      trace.push({ step: "ad_created", adId, timestamp: new Date().toISOString() });

      await dbClient
        .from("marketing_campaign_executions")
        .update({
          meta_ad_id: adId,
          publishing_step: "completed",
          status: "published",
          execution_trace: trace,
          updated_at: new Date().toISOString(),
        })
        .eq("id", executionId);
    }

    // Fetch updated final execution record
    const { data: finalRecord } = await dbClient
      .from("marketing_campaign_executions")
      .select("*")
      .eq("id", executionId)
      .single();

    return (finalRecord || record) as ExecutionRecord;
  } catch (err: any) {
    const safeMsg = err?.message || "Meta API publishing error occurred.";
    errors.push({
      step: record.publishing_step || "publishing",
      error: safeMsg,
      timestamp: new Date().toISOString(),
    });

    await dbClient
      .from("marketing_campaign_executions")
      .update({
        status: "publish_failed",
        error_log: errors,
        execution_trace: trace,
        updated_at: new Date().toISOString(),
      })
      .eq("id", executionId);

    throw err;
  }
}

/**
 * Helper to query Meta Graph API for live status of Campaign, Ad Set, and Ad
 */
export async function fetchMetaCampaignStatuses(
  accessToken: string,
  metaCampaignId?: string | null,
  metaAdsetId?: string | null,
  metaAdId?: string | null
): Promise<{
  campaignStatus: string;
  adsetStatus: string;
  adStatus: string;
  isLive: boolean;
}> {
  let campaignStatus = "PAUSED";
  let adsetStatus = "PAUSED";
  let adStatus = "PAUSED";
  let isLive = false;

  const baseUrl = getGraphBaseUrl();

  // 1. Campaign Status
  if (metaCampaignId && !metaCampaignId.startsWith("mock_")) {
    try {
      const url = `${baseUrl}/${metaCampaignId}?fields=id,name,status,effective_status&access_token=${accessToken}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && (data.status || data.effective_status)) {
        campaignStatus = data.effective_status || data.status;
        isLive = true;
      }
    } catch (err) {
      console.warn("Failed to fetch Meta Campaign status:", err);
    }
  }

  // 2. Ad Set Status
  if (metaAdsetId && !metaAdsetId.startsWith("mock_")) {
    try {
      const url = `${baseUrl}/${metaAdsetId}?fields=id,name,status,effective_status&access_token=${accessToken}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && (data.status || data.effective_status)) {
        adsetStatus = data.effective_status || data.status;
        isLive = true;
      }
    } catch (err) {
      console.warn("Failed to fetch Meta Ad Set status:", err);
    }
  }

  // 3. Ad Status
  if (metaAdId && !metaAdId.startsWith("mock_")) {
    try {
      const url = `${baseUrl}/${metaAdId}?fields=id,name,status,effective_status&access_token=${accessToken}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && (data.status || data.effective_status)) {
        adStatus = data.effective_status || data.status;
        isLive = true;
      }
    } catch (err) {
      console.warn("Failed to fetch Meta Ad status:", err);
    }
  }

  return {
    campaignStatus: String(campaignStatus).toUpperCase(),
    adsetStatus: String(adsetStatus).toUpperCase(),
    adStatus: String(adStatus).toUpperCase(),
    isLive,
  };
}

/**
 * Main Status Sync Function: Syncs current Meta status and updates database record
 */
export async function syncMetaExecutionStatus(
  supabase: any,
  executionId: string
) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbClient = serviceKey && serviceKey !== "[SENSITIVE]" ? createAdminClient() : supabase;

  // 1. Fetch current execution record
  const { data: record, error: fetchErr } = await dbClient
    .from("marketing_campaign_executions")
    .select("*")
    .eq("id", executionId)
    .single();

  if (fetchErr || !record) {
    throw new Error("Execution record not found.");
  }

  const connection = await loadMetaConnection(dbClient, record.website_id);
  if (!connection || !connection.access_token || connection.status !== "connected") {
    const trace = Array.isArray(record.execution_trace) ? record.execution_trace : [];
    const lastSync = trace.slice().reverse().find((t: any) => t.step === "status_synced")?.statuses || {};
    return {
      success: false,
      warning: "Unable to refresh Meta status. Showing the last known status.",
      executionId: record.id,
      metaCampaignId: record.meta_campaign_id,
      metaAdsetId: record.meta_adset_id,
      metaCreativeId: record.meta_creative_id,
      metaAdId: record.meta_ad_id,
      campaignStatus: lastSync.campaignStatus || "PAUSED",
      adsetStatus: lastSync.adsetStatus || "PAUSED",
      adStatus: lastSync.adStatus || "PAUSED",
      lastSyncedAt: record.updated_at,
    };
  }

  const statuses = await fetchMetaCampaignStatuses(
    connection.access_token,
    record.meta_campaign_id,
    record.meta_adset_id,
    record.meta_ad_id
  );

  const trace = Array.isArray(record.execution_trace) ? record.execution_trace : [];
  const nowStr = new Date().toISOString();

  trace.push({
    step: "status_synced",
    timestamp: nowStr,
    statuses,
  });

  await dbClient
    .from("marketing_campaign_executions")
    .update({
      execution_trace: trace,
      updated_at: nowStr,
    })
    .eq("id", executionId);

  return {
    success: true,
    executionId: record.id,
    metaCampaignId: record.meta_campaign_id,
    metaAdsetId: record.meta_adset_id,
    metaCreativeId: record.meta_creative_id,
    metaAdId: record.meta_ad_id,
    campaignStatus: statuses.campaignStatus,
    adsetStatus: statuses.adsetStatus,
    adStatus: statuses.adStatus,
    lastSyncedAt: nowStr,
  };
}

