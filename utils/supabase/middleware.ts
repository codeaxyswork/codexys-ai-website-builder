import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  // If Supabase environment variables are missing or unconfigured, bypass middleware smoothly
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("your-project")) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Domain Host Routing Check (Controlled by DOMAIN_ROUTING_ENABLED feature flag)
  const isRoutingEnabled = process.env.DOMAIN_ROUTING_ENABLED === "true";
  if (isRoutingEnabled) {
    const host = request.headers.get("host");
    const appDomain = (process.env.APP_DOMAIN || process.env.NEXT_PUBLIC_APP_DOMAIN || "localhost").toLowerCase().trim();
    const cleanHost = host ? host.split(":")[0].toLowerCase().trim() : "";

    // Ignore static assets, SaaS routes, and API routes
    const isSaaSPath =
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/site") ||
      pathname.startsWith("/sitemap") ||
      pathname.startsWith("/robots") ||
      pathname === "/";

    if (cleanHost && cleanHost !== appDomain && cleanHost !== "localhost" && cleanHost !== "127.0.0.1" && !isSaaSPath) {
      // Internal rewrite for custom domain host
      // If host is custom domain or subdomain, rewrite to /site/[host]
      const url = request.nextUrl.clone();
      url.pathname = `/site/${cleanHost}`;
      return NextResponse.rewrite(url);
    }
  }

  // Protect /admin routes: require authentication (server-side role check enforced in APIs/components)
  if (!user && pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Protect /dashboard route: redirect to /login if unauthenticated
  if (!user && pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from /login and /signup to /dashboard
  if (user && (pathname.startsWith("/login") || pathname.startsWith("/signup"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Check Platform Maintenance Mode
  const isExcludedFromMaintenance =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/maintenance") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next");

  if (!isExcludedFromMaintenance) {
    try {
      const { data: setting } = await supabase
        .from("platform_settings")
        .select("setting_value")
        .eq("setting_key", "maintenance_mode")
        .maybeSingle();

      if (setting?.setting_value?.enabled) {
        let isAdminUser = false;
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          if (profile && (profile.role === "admin" || profile.role === "super_admin")) {
            isAdminUser = true;
          }
        }
        if (!isAdminUser) {
          const url = request.nextUrl.clone();
          url.pathname = "/maintenance";
          return NextResponse.redirect(url);
        }
      }
    } catch {
      // Ignore errors in maintenance check to ensure zero outage
    }
  }

  return supabaseResponse;
}
