import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseDirectClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const DEFAULT_SUPABASE_URL = "https://yumsturujjjgdxsrqgbm.supabase.co";

export async function createClient() {
  const cookieStore = await cookies();

  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  let supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")
    .trim()
    .replace(/^["'\s]+|["'\s]+$/g, "");

  if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
    supabaseUrl = DEFAULT_SUPABASE_URL;
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            const rawDomain = (
              process.env.APP_DOMAIN ||
              process.env.NEXT_PUBLIC_APP_DOMAIN ||
              "codeaxys.com"
            ).toLowerCase().trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");

            const baseDomain = (rawDomain && !rawDomain.includes("localhost") && !rawDomain.includes("127.0.0.1")) ? rawDomain : "codeaxys.com";
            const cookieDomain = (baseDomain && !baseDomain.includes("localhost") && !baseDomain.includes("127.0.0.1")) ? `.${baseDomain}` : undefined;

            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                ...(cookieDomain ? { domain: cookieDomain } : {}),
              })
            );
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  );
}

export function createAdminClient() {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
    supabaseUrl = DEFAULT_SUPABASE_URL;
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim().replace(/^["'\s]+|["'\s]+$/g, "");

  const activeKey = serviceKey && serviceKey !== "[SENSITIVE]" && serviceKey.length > 20 ? serviceKey : anonKey;

  return createSupabaseDirectClient(supabaseUrl, activeKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

