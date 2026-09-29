import * as cheerio from "cheerio";

export interface MarketingBusinessContext {
  websiteId: string;
  userId: string;
  business: {
    name: string;
    category: string;
    description: string;
    location: {
      address: string | null;
      city: string | null;
      state: string | null;
      country: string | null;
      postalCode: string | null;
    };
    contact: {
      phone: string | null;
      email: string | null;
      openingHours: string | null;
    };
    services: string[];
    products: string[];
    pricingInfo: string[];
    offers: string[];
  };
  website: {
    title: string;
    domain: string | null;
    isPublished: boolean;
    publishedUrl: string | null;
    totalPages: number;
    creationType: "new" | "exact_migration" | "migration_redesign" | "unknown";
  };
  pages: Array<{
    id: string;
    path: string;
    title: string;
    metaDescription: string;
    isLandingPage: boolean;
    hasForm: boolean;
    ctas: Array<{ text: string; href: string }>;
  }>;
  seo: {
    seoTitle: string | null;
    metaDescription: string | null;
    focusKeywords: string[];
    topSearchQueries: Array<{ query: string; clicks: number; impressions: number; position: number }>;
  };
  localSeo: {
    localSeoScore: number | null;
    gbpProfileUrl: string | null;
  };
  brand: {
    logoUrl: string | null;
    primaryColor: string | null;
    featuredImages: string[];
  };
  metaAssets?: {
    adAccount: { id: string; name: string; currency: string; timezone: string } | null;
    facebookPage: { id: string; name: string; category: string } | null;
    instagramAccount: { id: string; username: string; name?: string } | null;
  };
}

/**
 * Builds a normalized, read-only MarketingBusinessContext object for a website
 * by aggregating existing website, page, SEO, local SEO, media, and GSC data.
 */
export async function buildMarketingBusinessContext(
  supabase: any,
  websiteId: string
): Promise<MarketingBusinessContext> {
  // 1. Concurrent DB Queries to fetch existing system data without N+1 overhead
  const [
    { data: website, error: webErr },
    { data: pageRows },
    { data: seoRow },
    { data: localRow },
    { data: mediaRows },
    { data: gscRows },
  ] = await Promise.all([
    supabase.from("websites").select("*").eq("id", websiteId).single(),
    supabase.from("website_pages").select("id, path, title, seo_title, meta_description, html_content").eq("website_id", websiteId),
    supabase.from("website_seo").select("seo_title, meta_description, focus_keywords").eq("website_id", websiteId).maybeSingle(),
    supabase.from("website_local_seo").select("business_name, business_type, address, city, state, country, postal_code, phone, email, opening_hours, local_seo_score, gbp_profile_url").eq("website_id", websiteId).maybeSingle(),
    supabase.from("media_assets").select("public_url, file_name, file_type").eq("website_id", websiteId).limit(20),
    supabase.from("gsc_search_analytics").select("query, clicks, impressions, position").eq("website_id", websiteId).order("clicks", { ascending: false }).limit(10),
  ]);

  let webData = website;
  let pagesData = pageRows;
  let seoData = seoRow;
  let localData = localRow;
  let mediaData = mediaRows;
  let gscData = gscRows;

  if (webErr || !webData) {
    const { createAdminClient } = require("./meta-client");
    const admin = createAdminClient();
    const [wRes, pRes, sRes, lRes, mRes, gRes] = await Promise.all([
      admin.from("websites").select("*").eq("id", websiteId).single(),
      admin.from("website_pages").select("id, path, title, seo_title, meta_description, html_content").eq("website_id", websiteId),
      admin.from("website_seo").select("seo_title, meta_description, focus_keywords").eq("website_id", websiteId).maybeSingle(),
      admin.from("website_local_seo").select("business_name, business_type, address, city, state, country, postal_code, phone, email, opening_hours, local_seo_score, gbp_profile_url").eq("website_id", websiteId).maybeSingle(),
      admin.from("media_assets").select("public_url, file_name, file_type").eq("website_id", websiteId).limit(20),
      admin.from("gsc_search_analytics").select("query, clicks, impressions, position").eq("website_id", websiteId).order("clicks", { ascending: false }).limit(10),
    ]);
    webData = wRes.data;
    pagesData = pRes.data;
    seoData = sRes.data;
    localData = lRes.data;
    mediaData = mRes.data;
    gscData = gRes.data;
  }

  if (!webData) {
    throw new Error(`Website not found or access denied for ID: ${websiteId}`);
  }

  const websiteRow = webData;
  const pageRowsList = pagesData;
  const seoDataRow = seoData;
  const localDataRow = localData;
  const mediaDataRows = mediaData;
  const gscDataRows = gscData;

  const userId = websiteRow.user_id;

  // 2. Derive Creation Type
  let creationType: "new" | "exact_migration" | "migration_redesign" | "unknown" = "unknown";
  const promptStr = websiteRow.prompt || "";
  const designPlan = websiteRow.design_plan || {};
  const isMigrated =
    promptStr.includes("[Migrated]") ||
    promptStr.toLowerCase().includes("migrated") ||
    designPlan.websiteType === "migrated" ||
    Boolean(designPlan.migration);

  if (isMigrated) {
    const hasRedesignSpec = designPlan.migration?.mode === "redesign" || Boolean(designPlan.redesign);
    creationType = hasRedesignSpec ? "migration_redesign" : "exact_migration";
  } else if (promptStr.length > 0) {
    creationType = "new";
  }

  // 3. Derive Published URL
  const { getProductionWebsiteUrl } = require("./meta-publisher");
  const publishedUrl = getProductionWebsiteUrl(websiteRow);

  // 4. HTML Parsing across pages for Services, Products, Pricing, Offers, CTAs, Forms, Images
  const pagesList = Array.isArray(pageRowsList) ? pageRowsList : [];
  const parsedPages: MarketingBusinessContext["pages"] = [];
  const servicesSet = new Set<string>();
  const productsSet = new Set<string>();
  const pricingSet = new Set<string>();
  const offersSet = new Set<string>();
  const featuredImagesSet = new Set<string>();
  let candidateLogoUrl: string | null = null;

  // Add focus_keywords to services set if available
  if (seoDataRow?.focus_keywords) {
    let kwList: string[] = [];
    if (Array.isArray(seoDataRow.focus_keywords)) {
      kwList = seoDataRow.focus_keywords;
    } else if (typeof seoDataRow.focus_keywords === "string") {
      kwList = seoDataRow.focus_keywords.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    kwList.forEach((kw) => servicesSet.add(kw));
  }

  // Add uploaded media to featuredImagesSet
  if (mediaDataRows && Array.isArray(mediaDataRows)) {
    mediaDataRows.forEach((m: any) => {
      if (m.public_url) featuredImagesSet.add(m.public_url);
    });
  }

  if (pagesList.length > 0) {
    pagesList.forEach((p: any) => {
      const html = p.html_content || "";
      const path = p.path || "index.html";
      const isLandingPage = path === "index.html" || path === "index" || path === "/";

      const $ = cheerio.load(html);

      // Extract title & meta description from HTML if missing in row
      const docTitle = $("title").first().text().trim();
      const docDesc = $('meta[name="description"]').attr("content")?.trim() || "";
      const pageTitle = p.title || p.seo_title || docTitle || (isLandingPage ? websiteRow.title : path);
      const metaDescription = p.meta_description || docDesc || "";

      // Form detection
      const hasForm = $("form").length > 0 || $("input[type='email']").length > 0 || $("textarea").length > 0;

      // CTA extraction
      const ctasList: Array<{ text: string; href: string }> = [];
      const seenCtas = new Set<string>();

      $("a[href], button").each((_, el) => {
        const text = $(el).text().trim().replace(/\s+/g, " ");
        const href = $(el).attr("href")?.trim() || "#";
        if (text.length >= 2 && text.length <= 40 && !text.toLowerCase().includes("privacy") && !text.toLowerCase().includes("terms")) {
          const key = `${text}::${href}`;
          if (!seenCtas.has(key)) {
            seenCtas.add(key);
            ctasList.push({ text, href });
          }
        }
      });

      parsedPages.push({
        id: p.id || `page-${parsedPages.length + 1}`,
        path,
        title: pageTitle,
        metaDescription,
        isLandingPage,
        hasForm,
        ctas: ctasList.slice(0, 10),
      });

      // Image extraction
      $("img[src]").each((_, el) => {
        const src = $(el).attr("src")?.trim();
        const alt = ($(el).attr("alt") || "").toLowerCase();
        const className = ($(el).attr("class") || "").toLowerCase();
        const idName = ($(el).attr("id") || "").toLowerCase();

        if (src && !src.startsWith("data:")) {
          if (alt.includes("logo") || className.includes("logo") || idName.includes("logo") || src.toLowerCase().includes("logo")) {
            if (!candidateLogoUrl) candidateLogoUrl = src;
          } else if (featuredImagesSet.size < 12 && src.startsWith("http")) {
            featuredImagesSet.add(src);
          }
        }
      });

      // Extract Services / Products / Pricing / Offers from headings and lists
      $("h2, h3, h4").each((_, el) => {
        const hText = $(el).text().trim();
        const hLower = hText.toLowerCase();
        const nextListItems: string[] = [];

        $(el).next("ul, ol").find("li").each((__, li) => {
          const itemText = $(li).text().trim();
          if (itemText.length >= 3 && itemText.length <= 60) {
            nextListItems.push(itemText);
          }
        });

        if (hLower.includes("service") || hLower.includes("what we do") || hLower.includes("treatments")) {
          nextListItems.forEach((i) => servicesSet.add(i));
        } else if (hLower.includes("product") || hLower.includes("inventory") || hLower.includes("showcase")) {
          nextListItems.forEach((i) => productsSet.add(i));
        } else if (hLower.includes("pricing") || hLower.includes("plans") || hLower.includes("cost")) {
          if (hText) pricingSet.add(hText);
          nextListItems.forEach((i) => pricingSet.add(i));
        } else if (hLower.includes("offer") || hLower.includes("discount") || hLower.includes("special")) {
          if (hText) offersSet.add(hText);
          nextListItems.forEach((i) => offersSet.add(i));
        }
      });
    });
  } else if (designPlan.migration?.urlMappings && Array.isArray(designPlan.migration.urlMappings)) {
    // Fallback: derive pages from design_plan migration metadata if DB query returned 0 rows
    const seenPaths = new Set<string>();
    designPlan.migration.urlMappings.forEach((m: any, idx: number) => {
      const slug = m.newSlug || m.originalPath || "/";
      if (!seenPaths.has(slug)) {
        seenPaths.add(slug);
        parsedPages.push({
          id: `migration-page-${idx + 1}`,
          path: slug,
          title: slug === "/" ? websiteRow.title : slug.replace(/^\//, "").replace(/-/g, " "),
          metaDescription: "",
          isLandingPage: slug === "/",
          hasForm: false,
          ctas: [],
        });
      }
    });
  }

  // Extract services/keywords from page titles & paths if heading list items are empty
  if (servicesSet.size === 0 && parsedPages.length > 0) {
    parsedPages.forEach((p) => {
      const pathLower = p.path.toLowerCase();
      if (!pathLower.includes("index") && !pathLower.includes("contact") && !pathLower.includes("gallery") && !pathLower.includes("blogs") && !pathLower.includes("profile")) {
        const cleanTitle = p.title.replace(/^\[.*?\]\s*/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " ").trim();
        if (cleanTitle && cleanTitle.length >= 3 && cleanTitle.length <= 60) {
          servicesSet.add(cleanTitle);
        }
      }
    });
  }

  // 5. Build Business Information
  const businessName = localDataRow?.business_name || websiteRow.title || "Untitled Business";
  
  let rawCategory =
    localDataRow?.business_type ||
    designPlan.business_category ||
    designPlan.industry ||
    designPlan.category ||
    null;

  let businessCategory = rawCategory && rawCategory !== "General Business" ? rawCategory : "";
  if (!businessCategory) {
    const combinedText = `${businessName} ${websiteRow.prompt || ""} ${parsedPages.map((p) => p.title).join(" ")}`.toLowerCase();
    if (combinedText.includes("naturopathy") || combinedText.includes("nature cure") || combinedText.includes("holistic")) {
      businessCategory = "Naturopathy & Holistic Healthcare Hospital";
    } else if (combinedText.includes("hospital") || combinedText.includes("clinic") || combinedText.includes("doctor")) {
      businessCategory = "Healthcare Clinic & Hospital";
    } else if (combinedText.includes("ayurveda") || combinedText.includes("wellness")) {
      businessCategory = "Ayurveda & Wellness Centre";
    } else if (combinedText.includes("car") || combinedText.includes("auto") || combinedText.includes("showroom")) {
      businessCategory = "Automotive Showroom & Dealership";
    } else if (combinedText.includes("real estate") || combinedText.includes("builder")) {
      businessCategory = "Real Estate & Construction";
    } else if (combinedText.includes("hotel") || combinedText.includes("resort")) {
      businessCategory = "Hospitality & Luxury Resort";
    } else {
      const cleanName = businessName.replace(/^\[.*?\]\s*/, "").trim();
      businessCategory = cleanName && cleanName.length > 3 ? cleanName : "Services";
    }
  }

  const businessDescription = websiteRow.prompt || seoDataRow?.meta_description || "";

  const location = {
    address: localDataRow?.address || null,
    city: localDataRow?.city || null,
    state: localDataRow?.state || null,
    country: localDataRow?.country || null,
    postalCode: localDataRow?.postal_code || null,
  };

  const contact = {
    phone: localDataRow?.phone || null,
    email: localDataRow?.email || null,
    openingHours: localDataRow?.opening_hours || null,
  };

  // 6. Build SEO Information
  let parsedKeywords: string[] = [];
  if (seoDataRow?.focus_keywords) {
    if (Array.isArray(seoDataRow.focus_keywords)) {
      parsedKeywords = seoDataRow.focus_keywords;
    } else if (typeof seoDataRow.focus_keywords === "string") {
      parsedKeywords = seoDataRow.focus_keywords.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
  }

  const topSearchQueries = (gscDataRows || []).map((r: any) => ({
    query: r.query,
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    position: r.position ? Number(r.position.toFixed(1)) : 0,
  }));

  const seo = {
    seoTitle: seoDataRow?.seo_title || null,
    metaDescription: seoDataRow?.meta_description || null,
    focusKeywords: parsedKeywords,
    topSearchQueries,
  };

  // 7. Build Local SEO Information
  const localSeo = {
    localSeoScore: localDataRow?.local_seo_score ?? null,
    gbpProfileUrl: localDataRow?.gbp_profile_url || null,
  };

  // 8. Build Brand & Visual Assets
  let primaryColor: string | null =
    designPlan.theme ||
    designPlan.color_scheme ||
    designPlan.primaryColor ||
    null;

  if (!primaryColor && Array.isArray(designPlan.colorPalette) && designPlan.colorPalette.length > 0) {
    primaryColor = designPlan.colorPalette[0].hex || designPlan.colorPalette[0].color || null;
  }

  const brand = {
    logoUrl: candidateLogoUrl,
    primaryColor,
    featuredImages: Array.from(featuredImagesSet),
  };

  // 9. Resolve Meta Selected Assets Context
  let metaAssets: MarketingBusinessContext["metaAssets"] = undefined;
  try {
    const { getWebsiteMetaAssets } = require("./meta-client");
    const metaData = await getWebsiteMetaAssets(supabase, websiteId);
    if (metaData) {
      metaAssets = {
        adAccount: metaData.selectedAdAccount
          ? {
              id: metaData.selectedAdAccount.id,
              name: metaData.selectedAdAccount.name,
              currency: metaData.selectedAdAccount.currency || "USD",
              timezone: metaData.selectedAdAccount.timezone || "UTC",
            }
          : null,
        facebookPage: metaData.selectedPage
          ? {
              id: metaData.selectedPage.id,
              name: metaData.selectedPage.name,
              category: metaData.selectedPage.category || "Business",
            }
          : null,
        instagramAccount: metaData.selectedInstagramAccount
          ? {
              id: metaData.selectedInstagramAccount.id,
              username: metaData.selectedInstagramAccount.username,
              name: metaData.selectedInstagramAccount.name,
            }
          : null,
      };
    }
  } catch (err) {
    // Meta assets resolution is optional if not connected
  }

  return {
    websiteId,
    userId,
    business: {
      name: businessName,
      category: businessCategory,
      description: businessDescription,
      location,
      contact,
      services: Array.from(servicesSet),
      products: Array.from(productsSet),
      pricingInfo: Array.from(pricingSet),
      offers: Array.from(offersSet),
    },
    website: {
      title: websiteRow.title || "Untitled Website",
      domain: websiteRow.domain || websiteRow.published_slug || null,
      isPublished: Boolean(websiteRow.is_published),
      publishedUrl,
      totalPages: parsedPages.length,
      creationType,
    },
    pages: parsedPages,
    seo,
    localSeo,
    brand,
    metaAssets,
  };
}
