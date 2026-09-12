import { createBrowserClient } from "@supabase/ssr";

export function getAuthRedirectUrl(): string {
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
  return `${origin.replace(/\/$/, "")}/auth/callback`;
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
