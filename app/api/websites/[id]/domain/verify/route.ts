import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyDomain } from "@/lib/domain-verification";

export async function POST(
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
        "id, title, custom_domain, custom_domain_verified, custom_domain_status, custom_domain_verified_at, domain_verification_token, www_domain_configured"
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

    if (!website.custom_domain) {
      return NextResponse.json(
        { error: "No custom domain configured for this website." },
        { status: 400 }
      );
    }

    // Run verification check
    const verificationResult = await verifyDomain(
      website.custom_domain,
      website.domain_verification_token || "",
      { wwwConfigured: website.www_domain_configured !== false }
    );

    // Update database status
    const updatePayload: Record<string, any> = {
      custom_domain_status: verificationResult.status,
      custom_domain_verified: verificationResult.verified,
      updated_at: new Date().toISOString(),
    };

    if (verificationResult.verified && !website.custom_domain_verified_at) {
      updatePayload.custom_domain_verified_at = new Date().toISOString();
    }

    const { data: updated, error: updateErr } = await supabase
      .from("websites")
      .update(updatePayload)
      .eq("id", websiteId)
      .select()
      .single();

    if (updateErr) {
      console.error("Database update error during domain verification:", updateErr);
    }

    return NextResponse.json({
      success: true,
      verified: verificationResult.verified,
      status: verificationResult.status,
      message: verificationResult.message,
      dnsInstructions: verificationResult.dnsRecordsRequired,
      dnsChecks: verificationResult.dnsChecks,
      sslReady: verificationResult.sslReady,
      vercelVerified: verificationResult.vercelVerified,
      domain: updated || website,
    });
  } catch (err: any) {
    console.error("POST Verify Domain API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to verify domain." },
      { status: 500 }
    );
  }
}
