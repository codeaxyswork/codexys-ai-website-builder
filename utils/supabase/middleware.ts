import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_SUPABASE_URL = "https://yumsturujjjgdxsrqgbm.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_qZERNQHUEVJN_deBFMDGLw_DQgJDwcS";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  let supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")
    .trim()
    .replace(/^["'\s]+|["'\s]+$/g, "");

  if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
    supabaseUrl = DEFAULT_SUPABASE_URL;
  }

  if (!supabaseAnonKey || supabaseAnonKey === "[SENSITIVE]" || supabaseAnonKey.length < 10) {
    supabaseAnonKey = DEFAULT_SUPABASE_ANON_KEY;
  }

  const applyResponseCookies = (targetRes: NextResponse) => {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      targetRes.cookies.set(cookie.name, cookie.value, cookie);
    });
    return targetRes;
  };

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          const rawDomain = (
            process.env.APP_DOMAIN ||
            process.env.NEXT_PUBLIC_APP_DOMAIN ||
            "codeaxys.com"
          ).toLowerCase().trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");

          const baseDomain = (rawDomain && !rawDomain.includes("localhost") && !rawDomain.includes("127.0.0.1")) ? rawDomain : "codeaxys.com";
          const cookieDomain = (baseDomain && !baseDomain.includes("localhost") && !baseDomain.includes("127.0.0.1")) ? `.${baseDomain}` : undefined;

          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              ...(cookieDomain ? { domain: cookieDomain } : {}),
            })
          );
        },
      },
    });

    let user: any = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data?.user || null;
    } catch (e) {
      // Ignore user fetch errors in middleware
    }

    const pathname = request.nextUrl.pathname;

    // Domain Host Routing Check
    const rawAppDomain = (
      process.env.APP_DOMAIN ||
      process.env.NEXT_PUBLIC_APP_DOMAIN ||
      "codeaxys.com"
    ).toLowerCase().trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");

    const baseDomain = (rawAppDomain && !rawAppDomain.includes("localhost") && !rawAppDomain.includes("vercel.app")) ? rawAppDomain : "codeaxys.com";

    const host = request.headers.get("host");
    const cleanHost = host ? host.split(":")[0].toLowerCase().trim() : "";

    // Ignore static assets, system routes, and API routes
    const isSaaSPath =
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/site") ||
      pathname.startsWith("/sitemap") ||
      pathname.startsWith("/robots") ||
      pathname.startsWith("/privacy-policy") ||
      pathname.startsWith("/pricing") ||
      pathname.startsWith("/media") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/maintenance");

    // Local Testing Hook: allow simulating subdomain resolution via header or query parameter
    const testSubdomain = request.headers.get("x-test-subdomain") || request.nextUrl.searchParams.get("__test_subdomain");

    if (testSubdomain && !isSaaSPath) {
      const cleanTestSlug = testSubdomain.toLowerCase().trim();
      const url = request.nextUrl.clone();
      const targetSubpath = pathname === "/" ? "" : pathname;
      url.pathname = `/site/${cleanTestSlug}${targetSubpath}`;
      return applyResponseCookies(NextResponse.rewrite(url));
    }

    if (cleanHost && !isSaaSPath) {
      const isMainDomain =
        cleanHost === baseDomain ||
        cleanHost === `www.${baseDomain}` ||
        cleanHost === "codeaxys.com" ||
        cleanHost === "www.codeaxys.com" ||
        cleanHost.endsWith(".vercel.app") ||
        cleanHost === "localhost" ||
        cleanHost === "127.0.0.1";

      if (!isMainDomain) {
        let targetSlug = cleanHost;

        // Platform Subdomain Check: e.g. mncc.codeaxys.com -> extract "mncc"
        if (cleanHost.endsWith(`.${baseDomain}`) || cleanHost.endsWith(".codeaxys.com")) {
          const matchedDomain = cleanHost.endsWith(`.${baseDomain}`) ? baseDomain : "codeaxys.com";
          const sub = cleanHost.slice(0, -(matchedDomain.length + 1)).trim();
          if (sub && sub !== "www" && sub !== "app" && sub !== "api" && sub !== "admin") {
            targetSlug = sub;
          }
        }

        const url = request.nextUrl.clone();
        const targetSubpath = pathname === "/" ? "" : pathname;
        url.pathname = `/site/${targetSlug}${targetSubpath}`;
        return applyResponseCookies(NextResponse.rewrite(url));
      }
    }

    // Protect /admin routes: require authentication
    if (!user && pathname.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return applyResponseCookies(NextResponse.redirect(url));
    }

    // Protect /dashboard route: redirect to /login if unauthenticated
    if (!user && pathname.startsWith("/dashboard")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return applyResponseCookies(NextResponse.redirect(url));
    }

    // Redirect authenticated users away from /login and /signup to /dashboard
    if (user && (pathname.startsWith("/login") || pathname.startsWith("/signup"))) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return applyResponseCookies(NextResponse.redirect(url));
    }

    // Check Platform Maintenance Mode
    const isExcludedFromMaintenance =
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api/admin") ||
      pathname.startsWith("/maintenance") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/privacy-policy") ||
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
            return applyResponseCookies(NextResponse.redirect(url));
          }
        }
      } catch {
        // Ignore errors in maintenance check
      }
    }

    return supabaseResponse;
  } catch (err) {
    console.error("Middleware Exception:", err);
    return supabaseResponse;
  }
}
