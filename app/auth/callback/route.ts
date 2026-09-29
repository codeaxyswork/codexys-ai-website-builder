import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const DEFAULT_SUPABASE_URL = "https://yumsturujjjgdxsrqgbm.supabase.co";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const token_hash = requestUrl.searchParams.get("token_hash");
    const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
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

    const cookieStore = await cookies();
    const response = NextResponse.redirect(targetUrl);

    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    let supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")
      .trim()
      .replace(/^["'\s]+|["'\s]+$/g, "");

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

    // 1. Token Hash OTP Verification Flow (Direct Email Confirmation / OTP Token)
    if (token_hash && type) {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        token_hash,
        type,
      });

      if (!verifyErr) {
        return response;
      } else {
        console.error("verifyOtp error in /auth/callback:", verifyErr.message);
        return NextResponse.redirect(
          `${baseUrl}/login?error=${encodeURIComponent(verifyErr.message)}`
        );
      }
    }

    // 2. PKCE Code Exchange Flow
    if (code) {
      const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);

      if (!exchangeErr) {
        return response;
      }

      console.error("Exchange code for session error:", exchangeErr.message);

      // If PKCE code verifier is missing (e.g. email link opened in another browser / device),
      // redirect to login with clear success confirmation message instead of scary error
      const isPkceError = exchangeErr.message.toLowerCase().includes("pkce") || exchangeErr.message.toLowerCase().includes("code verifier");
      
      if (isPkceError) {
        return NextResponse.redirect(
          `${baseUrl}/login?message=${encodeURIComponent("Email confirmed successfully! Please sign in with your credentials.")}`
        );
      }

      return NextResponse.redirect(
        `${baseUrl}/login?error=${encodeURIComponent(exchangeErr.message || "Authentication failed")}`
      );
    }

    return NextResponse.redirect(
      `${baseUrl}/login?error=Could%20not%20authenticate%20user`
    );
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

