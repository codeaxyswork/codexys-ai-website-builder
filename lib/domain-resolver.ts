import { createClient } from "@/utils/supabase/server";

export interface ResolvedDomainTarget {
  type: "app" | "subdomain" | "custom_domain";
  websiteId?: string;
  publishedSlug?: string;
  customDomain?: string;
  isPublished?: boolean;
}

export async function resolveWebsiteFromHost(hostHeader: string | null): Promise<ResolvedDomainTarget> {
  const isRoutingEnabled = process.env.DOMAIN_ROUTING_ENABLED === "true";
  if (!isRoutingEnabled || !hostHeader) {
    return { type: "app" };
  }

  // Clean host (strip port numbers if present, e.g. localhost:3000 -> localhost)
  const host = hostHeader.split(":")[0].toLowerCase().trim();

  const appDomain = (
    process.env.APP_DOMAIN ||
    process.env.NEXT_PUBLIC_APP_DOMAIN ||
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    "localhost"
  ).toLowerCase().trim();
  const platformDomain = (process.env.PLATFORM_DOMAIN || "codexys.site").toLowerCase().trim();

  // 1. Main Application Host Check
  if (host === appDomain || host === "localhost" || host === "127.0.0.1" || host === `app.${platformDomain}`) {
    return { type: "app" };
  }

  const supabase = await createClient();

  // 2. Subdomain Host Check (e.g. my-site.codexys.site or my-site.appdomain.com)
  if (host.endsWith(`.${platformDomain}`) || host.endsWith(`.${appDomain}`)) {
    const parts = host.split(".");
    const subdomain = parts[0];

    const { data: website } = await supabase
      .from("websites")
      .select("id, published_slug, is_published")
      .eq("published_slug", subdomain)
      .eq("is_published", true)
      .single();

    if (website) {
      return {
        type: "subdomain",
        websiteId: website.id,
        publishedSlug: website.published_slug,
        isPublished: website.is_published,
      };
    }
  }

  // 3. Custom Domain Host Check (e.g. customerbrand.com or www.customerbrand.com)
  const rootCustomDomain = host.startsWith("www.") ? host.slice(4) : host;

  const { data: customSite } = await supabase
    .from("websites")
    .select("id, published_slug, is_published, custom_domain")
    .or(`custom_domain.eq.${host},custom_domain.eq.${rootCustomDomain}`)
    .eq("is_published", true)
    .single();

  if (customSite) {
    return {
      type: "custom_domain",
      websiteId: customSite.id,
      publishedSlug: customSite.published_slug,
      customDomain: customSite.custom_domain,
      isPublished: customSite.is_published,
    };
  }

  return { type: "app" };
}
