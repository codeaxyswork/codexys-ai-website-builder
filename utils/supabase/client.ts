import { createBrowserClient } from "@supabase/ssr";

const DEFAULT_SUPABASE_URL = "https://yumsturujjjgdxsrqgbm.supabase.co";

export function getAuthRedirectUrl(nextPath?: string): string {
  let origin = "";
  if (typeof window !== "undefined" && window.location?.origin) {
    origin = window.location.origin;
  } else if (process.env.NEXT_PUBLIC_SITE_URL) {
    origin = process.env.NEXT_PUBLIC_SITE_URL;
  } else if (process.env.NEXT_PUBLIC_APP_URL) {
    origin = process.env.NEXT_PUBLIC_APP_URL;
  } else if (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
    origin = `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
  } else if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    origin = `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  } else {
    origin = "http://localhost:3000";
  }
  const cleanOrigin = origin.replace(/\/$/, "");
  const callbackUrl = `${cleanOrigin}/auth/callback`;
  return nextPath ? `${callbackUrl}?next=${encodeURIComponent(nextPath)}` : callbackUrl;
}

export function createClient() {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
    supabaseUrl = DEFAULT_SUPABASE_URL;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
