import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  verifyDomain,
  addDomainToVercel,
  removeDomainFromVercel,
} from "@/lib/domain-verification";
import { normalizeCustomDomainInput } from "@/lib/domain-resolver";
import { getUserUsage } from "@/lib/billing";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify website ownership
    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select(
        "id, title, slug, is_published, published_slug, custom_domain, custom_domain_verified, custom_domain_status, custom_domain_verified_at, domain_verification_token, www_domain_configured"
      )
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (websiteErr || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 404 }
      );
    }

    let verificationInfo: any = null;
    if (website.custom_domain) {
      verificationInfo = await verifyDomain(
        website.custom_domain,
        website.domain_verification_token || "",
        { wwwConfigured: website.www_domain_configured !== false }
      );
    }

    return NextResponse.json({
      domain: {
        custom_domain: website.custom_domain,
        custom_domain_verified: Boolean(website.custom_domain_verified),
        custom_domain_status: website.custom_domain_status || (website.custom_domain ? "pending_dns" : "none"),
        custom_domain_verified_at: website.custom_domain_verified_at,
        domain_verification_token: website.domain_verification_token,
        www_domain_configured: website.www_domain_configured !== false,
      },
      dnsInstructions: verificationInfo?.dnsRecordsRequired || null,
      verificationMessage: verificationInfo?.message || null,
      dnsChecks: verificationInfo?.dnsChecks || null,
      sslReady: verificationInfo?.sslReady || false,
      vercelVerified: verificationInfo?.vercelVerified || false,
    });
  } catch (err: any) {
    console.error("GET Domain API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch domain settings." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check Plan permissions
    const usage = await getUserUsage(user.id);
    const allowCustomDomain = Boolean(usage?.plan?.allow_custom_domain);

    if (!allowCustomDomain) {
      return NextResponse.json(
        {
          error: "Custom domain connection requires a Pro or Agency subscription plan.",
          code: "UPGRADE_REQUIRED",
        },
        { status: 403 }
      );
    }

    // Verify website ownership
    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select("id, custom_domain, domain_verification_token, custom_domain_verified_at")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (websiteErr || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const rawDomain = body.custom_domain || "";
    const wwwConfigured = body.www_domain_configured !== false;

    // 1. Validate & Normalize Domain
    const norm = normalizeCustomDomainInput(rawDomain);
    if (!norm.isValid) {
      return NextResponse.json(
        { error: norm.error || "Invalid domain format. Please enter a valid domain name (e.g., example.com)." },
        { status: 400 }
      );
    }

    const cleanDomain = norm.canonicalDomain;
    const wwwDomain = norm.wwwDomain;

    // 2. Prevent Domain Conflict / Hijacking Across All Websites
    const { data: conflictSites } = await supabase
      .from("websites")
      .select("id, title")
      .neq("id", websiteId)
      .or(`custom_domain.eq.${cleanDomain},custom_domain.eq.${wwwDomain}`)
      .limit(1);

    if (conflictSites && conflictSites.length > 0) {
      return NextResponse.json(
        {
          error: `Domain "${cleanDomain}" is already connected to another website. Please remove it from the other website before connecting it here.`,
          code: "DOMAIN_CONFLICT",
        },
        { status: 409 }
      );
    }

    // 3. If previous domain was different, detach old domain from Vercel
    if (website.custom_domain && website.custom_domain !== cleanDomain) {
      await removeDomainFromVercel(website.custom_domain);
      await removeDomainFromVercel(`www.${website.custom_domain}`);
    }

    // 4. Attach domain to Vercel Project dynamically
    await addDomainToVercel(cleanDomain);
    if (wwwConfigured) {
      await addDomainToVercel(wwwDomain);
    }

    // 5. Generate token if not already existing
    const token =
      website.domain_verification_token ||
      `codexys-verify-${Math.random().toString(36).substring(2, 10)}`;

    // 6. Perform live DNS & Vercel verification
    const verificationResult = await verifyDomain(cleanDomain, token, {
      wwwConfigured,
    });

    const updatePayload = {
      custom_domain: cleanDomain,
      custom_domain_status: verificationResult.status,
      custom_domain_verified: verificationResult.verified,
      custom_domain_verified_at: verificationResult.verified
        ? website.custom_domain_verified_at || new Date().toISOString()
        : null,
      domain_verification_token: token,
      www_domain_configured: wwwConfigured,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateErr } = await supabase
      .from("websites")
      .update(updatePayload)
      .eq("id", websiteId)
      .select()
      .single();

    if (updateErr) {
      console.error("Update Custom Domain Error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      domain: updated,
      dnsInstructions: verificationResult.dnsRecordsRequired,
      verificationMessage: verificationResult.message,
      dnsChecks: verificationResult.dnsChecks,
      sslReady: verificationResult.sslReady,
      vercelVerified: verificationResult.vercelVerified,
      status: verificationResult.status,
      message: "Custom domain configuration saved successfully.",
    });
  } catch (err: any) {
    console.error("PUT Domain API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update domain settings." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const { data: website, error: websiteErr } = await supabase
      .from("websites")
      .select("id, custom_domain")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (websiteErr || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 404 }
      );
    }

    // Detach domain and www subdomain from Vercel
    if (website.custom_domain) {
      await removeDomainFromVercel(website.custom_domain);
      await removeDomainFromVercel(`www.${website.custom_domain}`);
    }

    const { error: updateErr } = await supabase
      .from("websites")
      .update({
        custom_domain: null,
        custom_domain_verified: false,
        custom_domain_status: "none",
        custom_domain_verified_at: null,
        domain_verification_token: null,
        www_domain_configured: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", websiteId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Custom domain removed successfully.",
    });
  } catch (err: any) {
    console.error("DELETE Domain API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete domain." },
      { status: 500 }
    );
  }
}
