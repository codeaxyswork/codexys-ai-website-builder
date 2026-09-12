import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyDomain, sanitizeDomain, isValidDomain } from "@/lib/domain-verification";
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

    const verificationInfo = await verifyDomain(
      website.custom_domain || "",
      website.domain_verification_token || ""
    );

    return NextResponse.json({
      domain: {
        custom_domain: website.custom_domain,
        custom_domain_verified: Boolean(website.custom_domain_verified),
        custom_domain_status: website.custom_domain_status || "none",
        custom_domain_verified_at: website.custom_domain_verified_at,
        domain_verification_token: website.domain_verification_token,
        www_domain_configured: Boolean(website.www_domain_configured),
      },
      dnsInstructions: verificationInfo.dnsRecordsRequired,
      verificationMessage: verificationInfo.message,
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
      .select("id, custom_domain, domain_verification_token")
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
    const wwwConfigured = Boolean(body.www_domain_configured);

    if (!rawDomain.trim()) {
      return NextResponse.json(
        { error: "Domain name cannot be empty." },
        { status: 400 }
      );
    }

    // Clean domain string (automatically strips https://, http://, trailing slashes, paths, and ports)
    const cleanDomain = sanitizeDomain(rawDomain);

    if (!cleanDomain || !isValidDomain(cleanDomain)) {
      return NextResponse.json(
        { error: "Invalid domain format. Please enter a valid domain (e.g., example.com or www.example.com)." },
        { status: 400 }
      );
    }

    // Generate token if not already existing
    const token =
      website.domain_verification_token ||
      `codexys-verify-${Math.random().toString(36).substring(2, 10)}`;

    const verificationResult = await verifyDomain(cleanDomain, token);

    const updatePayload = {
      custom_domain: cleanDomain,
      custom_domain_status: verificationResult.status,
      custom_domain_verified: verificationResult.verified,
      custom_domain_verified_at: verificationResult.verified ? new Date().toISOString() : null,
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
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (websiteErr || !website) {
      return NextResponse.json(
        { error: "Website not found or access denied." },
        { status: 404 }
      );
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
