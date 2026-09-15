import * as cheerio from "cheerio";

export interface LocalBusinessProfile {
  business_name?: string | null;
  business_type?: string | null;
  primary_category?: string | null;
  additional_categories?: string[] | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state_region?: string | null;
  postal_code?: string | null;
  country?: string | null;
  phone?: string | null;
  website_url?: string | null;
  business_description?: string | null;
  service_area?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  opening_hours?: Array<{ day: string; opens: string; closes: string }> | null;
  price_range?: string | null;
  logo_url?: string | null;
  image_url?: string | null;
  social_profiles?: string[] | null;
  contact_url?: string | null;
  appointment_url?: string | null;
  gbp_profile_url?: string | null;
}

export interface LocalSEOIssue {
  id: string;
  severity: "critical" | "warning" | "opportunity" | "passed";
  title: string;
  details: string;
  affectedPage?: string;
  recommendation: string;
}

export interface LocalSEOAnalysisResult {
  local_seo_score: number;
  profile_completeness: {
    score: number;
    max: 30;
    completed_fields: number;
    total_fields: number;
  };
  nap_health: {
    score: number;
    max: 25;
    name_status: "consistent" | "missing_on_site" | "not_configured";
    address_status: "consistent" | "missing_on_site" | "not_configured";
    phone_status: "consistent" | "missing_on_site" | "not_configured";
    details: string;
  };
  local_keyword_health: {
    score: number;
    max: 25;
    pages_with_location_terms: number;
    total_pages_audited: number;
    details: string;
  };
  schema_health: {
    score: number;
    max: 20;
    schema_type: string;
    has_valid_schema: boolean;
    missing_properties: string[];
    details: string;
  };
  issues: LocalSEOIssue[];
  schema_markup: Record<string, any> | null;
  gbp_status: {
    configured: boolean;
    profile_url?: string | null;
    guidance: string;
  };
  last_analyzed_at: string;
}

export interface PageContentInput {
  path: string;
  htmlContent: string;
  title?: string | null;
  focus_keywords?: string[] | null;
}

/**
 * Deterministically analyzes Local SEO signals across configured profile and site HTML.
 * Costs 0 AI credits.
 */
export function analyzeLocalSEO(
  profile: LocalBusinessProfile = {},
  pages: PageContentInput[] = []
): LocalSEOAnalysisResult {
  const issues: LocalSEOIssue[] = [];

  // 1. Profile Completeness Audit (30 Points Max)
  const trackedFields: Array<{ key: keyof LocalBusinessProfile; label: string; essential: boolean }> = [
    { key: "business_name", label: "Business Name", essential: true },
    { key: "business_type", label: "Business Type", essential: true },
    { key: "primary_category", label: "Primary Category", essential: true },
    { key: "phone", label: "Phone Number", essential: true },
    { key: "city", label: "City", essential: true },
    { key: "state_region", label: "State / Region", essential: false },
    { key: "address_line1", label: "Address Line 1", essential: false },
    { key: "country", label: "Country", essential: false },
    { key: "business_description", label: "Business Description", essential: false },
    { key: "service_area", label: "Service Area", essential: false },
    { key: "opening_hours", label: "Opening Hours", essential: false },
  ];

  let completedCount = 0;
  trackedFields.forEach((f) => {
    const val = profile[f.key];
    if (val && (typeof val === "string" ? val.trim().length > 0 : Array.isArray(val) ? val.length > 0 : true)) {
      completedCount++;
    } else if (f.essential) {
      issues.push({
        id: `profile-missing-${f.key}`,
        severity: "critical",
        title: `Missing Essential Field: ${f.label}`,
        details: `Configuring your ${f.label.toLowerCase()} is essential for local search ranking signals.`,
        recommendation: `Add your ${f.label} in the Local SEO Business Profile tab.`,
      });
    }
  });

  const profileRatio = completedCount / trackedFields.length;
  const profileScore = Math.round(profileRatio * 30);

  // 2. NAP Consistency Audit (25 Points Max)
  let aggregateSiteText = "";
  pages.forEach((p) => {
    const $ = cheerio.load(p.htmlContent || "");
    aggregateSiteText += " " + $("body").text().toLowerCase().replace(/\s+/g, " ");
  });

  let napScore = 0;
  let nameStatus: "consistent" | "missing_on_site" | "not_configured" = "not_configured";
  let addressStatus: "consistent" | "missing_on_site" | "not_configured" = "not_configured";
  let phoneStatus: "consistent" | "missing_on_site" | "not_configured" = "not_configured";

  // Name check
  if (profile.business_name && profile.business_name.trim().length > 0) {
    const bNameLower = profile.business_name.toLowerCase().trim();
    if (aggregateSiteText.includes(bNameLower)) {
      nameStatus = "consistent";
      napScore += 10;
    } else {
      nameStatus = "missing_on_site";
      issues.push({
        id: "nap-name-missing",
        severity: "warning",
        title: "Business Name Not Detected in Site Copy",
        details: `The exact business name "${profile.business_name}" was not detected in published website text.`,
        recommendation: "Ensure your official business name appears clearly in website headers or footers.",
      });
    }
  } else {
    nameStatus = "not_configured";
  }

  // Phone check
  if (profile.phone && profile.phone.trim().length > 0) {
    const rawPhoneDigits = profile.phone.replace(/\D/g, "");
    const rawSiteDigits = aggregateSiteText.replace(/\D/g, "");
    if (rawPhoneDigits.length >= 7 && rawSiteDigits.includes(rawPhoneDigits)) {
      phoneStatus = "consistent";
      napScore += 8;
    } else {
      phoneStatus = "missing_on_site";
      issues.push({
        id: "nap-phone-missing",
        severity: "warning",
        title: "Phone Number Not Detected in Site Copy",
        details: `Configured phone number "${profile.phone}" was not found in page content.`,
        recommendation: "Add your official phone number with click-to-call links in the website footer or header.",
      });
    }
  }

  // City / Address check
  if (profile.city && profile.city.trim().length > 0) {
    const cityLower = profile.city.toLowerCase().trim();
    if (aggregateSiteText.includes(cityLower)) {
      addressStatus = "consistent";
      napScore += 7;
    } else {
      addressStatus = "missing_on_site";
      issues.push({
        id: "nap-address-missing",
        severity: "warning",
        title: "City / Location Not Mentioned in Site Copy",
        details: `Your target city "${profile.city}" was not found in website page text.`,
        recommendation: "Include your target city or service area in page descriptions and footer contact info.",
      });
    }
  }

  // 3. Local Keyword & Location Signals Audit (25 Points Max)
  let pagesWithLocation = 0;
  const targetCity = (profile.city || "").toLowerCase().trim();
  const targetState = (profile.state_region || "").toLowerCase().trim();

  pages.forEach((page) => {
    const $ = cheerio.load(page.htmlContent || "");
    const pageTitle = (page.title || $("title").text()).toLowerCase();
    const pageH1 = $("h1").text().toLowerCase();
    const pageText = $("body").text().toLowerCase();

    const hasCity = targetCity.length > 0 && (pageTitle.includes(targetCity) || pageH1.includes(targetCity) || pageText.includes(targetCity));
    const hasState = targetState.length > 0 && (pageTitle.includes(targetState) || pageH1.includes(targetState) || pageText.includes(targetState));

    if (hasCity || hasState) {
      pagesWithLocation++;
    }
  });

  const totalPages = Math.max(1, pages.length);
  const locationRatio = pagesWithLocation / totalPages;
  const localKeywordScore = Math.round(locationRatio * 25);

  if (targetCity && pagesWithLocation === 0) {
    issues.push({
      id: "local-keywords-none",
      severity: "warning",
      title: "No Location Signals in Page Titles or Headings",
      details: `Target city "${profile.city}" is missing from all page titles and headings.`,
      recommendation: `Incorporate your primary location "${profile.city}" into homepage and service page headings.`,
    });
  }

  // 4. Local Business Schema Audit (20 Points Max)
  const schemaObj = generateLocalBusinessSchema(profile);
  let schemaScore = 0;
  const missingSchemaProps: string[] = [];

  if (schemaObj) {
    schemaScore += 10;
    if (profile.address_line1 && profile.city) schemaScore += 4;
    else missingSchemaProps.push("address");

    if (profile.phone) schemaScore += 3;
    else missingSchemaProps.push("telephone");

    if (profile.latitude && profile.longitude) schemaScore += 3;
    else missingSchemaProps.push("geo");

    if (missingSchemaProps.length === 0) {
      issues.push({
        id: "local-schema-complete",
        severity: "passed",
        title: `Valid ${schemaObj["@type"]} Schema Generated`,
        details: `Structured JSON-LD ${schemaObj["@type"]} schema is fully generated.`,
        recommendation: "Embed JSON-LD schema into website head metadata.",
      });
    } else {
      issues.push({
        id: "local-schema-incomplete",
        severity: "opportunity",
        title: "Local Schema Missing Secondary Properties",
        details: `Schema markup is missing optional fields: ${missingSchemaProps.join(", ")}.`,
        recommendation: `Add ${missingSchemaProps.join(", ")} in Local SEO settings for complete rich snippet coverage.`,
      });
    }
  } else {
    issues.push({
      id: "local-schema-missing",
      severity: "critical",
      title: "LocalBusiness Structured Data Schema Missing",
      details: "Configure business name and type to generate valid LocalBusiness schema.",
      recommendation: "Fill out your Business Name and Type in the Local SEO tab.",
    });
  }

  // Total Local SEO Score (0-100)
  const totalScore = Math.min(100, Math.max(0, profileScore + napScore + localKeywordScore + schemaScore));

  const gbpConfigured = !!(profile.gbp_profile_url && profile.gbp_profile_url.trim().startsWith("http"));

  return {
    local_seo_score: totalScore,
    profile_completeness: {
      score: profileScore,
      max: 30,
      completed_fields: completedCount,
      total_fields: trackedFields.length,
    },
    nap_health: {
      score: napScore,
      max: 25,
      name_status: nameStatus,
      address_status: addressStatus,
      phone_status: phoneStatus,
      details: `NAP consistency score: ${napScore}/25. Name: ${nameStatus}, Phone: ${phoneStatus}, Address: ${addressStatus}.`,
    },
    local_keyword_health: {
      score: localKeywordScore,
      max: 25,
      pages_with_location_terms: pagesWithLocation,
      total_pages_audited: pages.length,
      details: `${pagesWithLocation} of ${pages.length} pages include local location terms.`,
    },
    schema_health: {
      score: schemaScore,
      max: 20,
      schema_type: profile.business_type || "LocalBusiness",
      has_valid_schema: !!schemaObj,
      missing_properties: missingSchemaProps,
      details: schemaObj ? `${schemaObj["@type"]} schema ready.` : "Schema requires business profile configuration.",
    },
    issues,
    schema_markup: schemaObj,
    gbp_status: {
      configured: gbpConfigured,
      profile_url: profile.gbp_profile_url || null,
      guidance: gbpConfigured
        ? "Google Business Profile URL linked."
        : "Link your Google Business Profile URL for enhanced local map pack relevance.",
    },
    last_analyzed_at: new Date().toISOString(),
  };
}

/**
 * Deterministically constructs valid LocalBusiness JSON-LD schema payload.
 */
export function generateLocalBusinessSchema(profile: LocalBusinessProfile): Record<string, any> | null {
  if (!profile.business_name || profile.business_name.trim().length === 0) {
    return null;
  }

  const validTypes = [
    "LocalBusiness",
    "Restaurant",
    "Hotel",
    "MedicalBusiness",
    "ProfessionalService",
    "Store",
    "FinancialService",
    "AutomotiveBusiness",
    "HealthAndBeautyBusiness",
    "Organization",
  ];

  const type = profile.business_type && validTypes.includes(profile.business_type) ? profile.business_type : "LocalBusiness";

  const schema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": type,
    name: profile.business_name.trim(),
  };

  if (profile.business_description) schema.description = profile.business_description.trim();
  if (profile.website_url) schema.url = profile.website_url.trim();
  if (profile.phone) schema.telephone = profile.phone.trim();
  if (profile.price_range) schema.priceRange = profile.price_range.trim();
  if (profile.logo_url) schema.logo = profile.logo_url.trim();
  if (profile.image_url) schema.image = profile.image_url.trim();

  // Address
  if (profile.address_line1 || profile.city || profile.country) {
    const address: Record<string, string> = {
      "@type": "PostalAddress",
    };
    if (profile.address_line1) address.streetAddress = profile.address_line1.trim();
    if (profile.city) address.addressLocality = profile.city.trim();
    if (profile.state_region) address.addressRegion = profile.state_region.trim();
    if (profile.postal_code) address.postalCode = profile.postal_code.trim();
    if (profile.country) address.addressCountry = profile.country.trim();
    schema.address = address;
  }

  // Geo Coordinates
  if (typeof profile.latitude === "number" && typeof profile.longitude === "number") {
    schema.geo = {
      "@type": "GeoCoordinates",
      latitude: profile.latitude,
      longitude: profile.longitude,
    };
  }

  // Service Area
  if (profile.service_area) {
    schema.areaServed = profile.service_area.trim();
  }

  // Opening Hours
  if (profile.opening_hours && Array.isArray(profile.opening_hours) && profile.opening_hours.length > 0) {
    schema.openingHoursSpecification = profile.opening_hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.day,
      opens: h.opens,
      closes: h.closes,
    }));
  }

  // Social Profiles / SameAs
  if (profile.social_profiles && Array.isArray(profile.social_profiles) && profile.social_profiles.length > 0) {
    schema.sameAs = profile.social_profiles.filter((s) => s && s.trim().length > 0);
  }

  return schema;
}
