import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseDirectClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  let cookieStore: any = null;
  try {
    cookieStore = await cookies();
  } catch {
    // Called outside a Next.js request context (e.g., unit/integration tests or CLI runners)
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")
    .trim()
    .replace(/^["'\s]+|["'\s]+$/g, "");

  if (!supabaseUrl || !supabaseUrl.startsWith("http") || !supabaseAnonKey || supabaseAnonKey.length < 10) {
    throw new Error(
      "[Supabase Config Error] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or invalid. Execution halted to protect database integrity."
    );
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore ? cookieStore.getAll() : [];
        },
        setAll(cookiesToSet) {
          if (!cookieStore) return;
          try {
            const rawDomain = (
              process.env.APP_DOMAIN ||
              process.env.NEXT_PUBLIC_APP_DOMAIN ||
              ""
            ).toLowerCase().trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");

            const isLocal =
              !rawDomain ||
              rawDomain.includes("localhost") ||
              rawDomain.includes("127.0.0.1");

            const cookieDomain = isLocal ? undefined : `.${rawDomain.replace(/^\./, "")}`;

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

export function isServiceRoleConfigured(): boolean {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(serviceKey && serviceKey !== "[SENSITIVE]" && serviceKey.trim().length > 20);
}

export function createAdminClient() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!supabaseUrl || !supabaseUrl.startsWith("http")) {
    throw new Error(
      "[Supabase Config Error] NEXT_PUBLIC_SUPABASE_URL is missing or invalid in createAdminClient(). Execution halted."
    );
  }

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim().replace(/^["'\s]+|["'\s]+$/g, "");
  if (!serviceKey || serviceKey === "[SENSITIVE]" || serviceKey.length < 20) {
    throw new Error(
      "[Supabase Config Error] SUPABASE_SERVICE_ROLE_KEY is required for privileged operations in createAdminClient(). Never falling back to anon key."
    );
  }

  return createSupabaseDirectClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}


