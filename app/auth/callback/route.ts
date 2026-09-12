import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const DEFAULT_SUPABASE_URL = "https://yumsturujjjgdxsrqgbm.supabase.co";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const next = requestUrl.searchParams.get("next") ?? "/dashboard";

    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";

    let targetUrl = `${requestUrl.origin}${next}`;
    if (!isLocalEnv && forwardedHost) {
      const protocol = request.headers.get("x-forwarded-proto") || "https";
      targetUrl = `${protocol}://${forwardedHost}${next}`;
    }

    const baseUrl = !isLocalEnv && forwardedHost
      ? `${request.headers.get("x-forwarded-proto") || "https"}://${forwardedHost}`
      : requestUrl.origin;

    if (!code) {
      return NextResponse.redirect(
        `${baseUrl}/login?error=Could%20not%20authenticate%20user`
      );
    }

    const cookieStore = await cookies();
    const response = NextResponse.redirect(targetUrl);

    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
      supabaseUrl = DEFAULT_SUPABASE_URL;
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Supabase credentials missing or invalid in /auth/callback");
      return NextResponse.redirect(
        `${baseUrl}/login?error=Authentication%20configuration%20error`
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Ignore if called from context where cookieStore is read-only
            }
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return response;
    } else {
      console.error("Exchange code for session error:", error?.message || error);
      return NextResponse.redirect(
        `${baseUrl}/login?error=${encodeURIComponent(error?.message || "Authentication failed")}`
      );
    }
  } catch (err: any) {
    console.error("Unhandled exception in /auth/callback:", err?.message || err);
    try {
      const requestUrl = new URL(request.url);
      return NextResponse.redirect(
        `${requestUrl.origin}/login?error=${encodeURIComponent(err?.message || "Authentication failed")}`
      );
    } catch {
      return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
    }
  }
}

