import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export interface CustomerDomainItem {
  domain: string;
  source: "registered" | "external";
  websiteId: string | null;
  websiteTitle: string | null;
  status: "active" | "expired" | "verifying" | "ready" | "pending_dns";
  verified: boolean;
  registrationDate: string | null;
  expiryDate: string | null;
  autoRenew: boolean;
  resellerOrderId: string | null;
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // 1. Fetch Websites Owned by User (to map custom domains and site titles)
    const { data: websites } = await adminSupabase
      .from("websites")
      .select("id, title, custom_domain, custom_domain_verified, custom_domain_status, custom_domain_verified_at")
      .eq("user_id", user.id);

    const siteMap = new Map<string, { id: string; title: string; verified: boolean; status: string }>();
    (websites || []).forEach((w: any) => {
      if (w.custom_domain) {
        siteMap.set(w.custom_domain.toLowerCase().trim(), {
          id: w.id,
          title: w.title,
          verified: Boolean(w.custom_domain_verified),
          status: w.custom_domain_status || "none",
        });
      }
    });

    // 2. Fetch Completed Domain Registrations from billing_transactions
    const { data: regTxs } = await adminSupabase
      .from("billing_transactions")
      .select("id, provider_payment_id, amount, currency, created_at, metadata")
      .eq("user_id", user.id)
      .eq("transaction_type", "domain_registration")
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    const domainsList: CustomerDomainItem[] = [];
    const seenDomains = new Set<string>();

    (regTxs || []).forEach((tx: any) => {
      const meta = tx.metadata || {};
      const domainName = (meta.domain_name || "").toLowerCase().trim();
      if (!domainName || seenDomains.has(domainName)) return;
      seenDomains.add(domainName);

      const mappedSite = siteMap.get(domainName);
      const isExpired = meta.expiry_date ? new Date(meta.expiry_date).getTime() < Date.now() : false;

      domainsList.push({
        domain: domainName,
        source: "registered",
        websiteId: mappedSite?.id || meta.website_id || null,
        websiteTitle: mappedSite?.title || null,
        status: isExpired ? "expired" : "active",
        verified: true,
        registrationDate: meta.registration_date || tx.created_at,
        expiryDate: meta.expiry_date || null,
        autoRenew: meta.auto_renew !== false,
        resellerOrderId: meta.resellerclub_order_id || null,
      });
    });

    // 3. Add any external custom domains connected to websites that were not purchased via ResellerClub
    (websites || []).forEach((w: any) => {
      if (!w.custom_domain) return;
      const cleanCustom = w.custom_domain.toLowerCase().trim();
      if (seenDomains.has(cleanCustom)) return;
      seenDomains.add(cleanCustom);

      domainsList.push({
        domain: cleanCustom,
        source: "external",
        websiteId: w.id,
        websiteTitle: w.title,
        status: w.custom_domain_verified ? "ready" : "pending_dns",
        verified: Boolean(w.custom_domain_verified),
        registrationDate: w.custom_domain_verified_at || null,
        expiryDate: null, // External registrar manages expiry
        autoRenew: false,
        resellerOrderId: null,
      });
    });

    return NextResponse.json({
      success: true,
      domains: domainsList,
      count: domainsList.length,
    });
  } catch (err: any) {
    console.error("[My Domains API] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to retrieve customer domains." },
      { status: 500 }
    );
  }
}

