import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { renewDomain, parseDomainQuery, getDomainPricingMap } from "@/lib/resellerclub";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain: rawDomainParam } = await params;
    const domainName = decodeURIComponent(rawDomainParam || "").toLowerCase().trim();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const years = Math.max(1, Math.min(10, parseInt(body.years, 10) || 1));

    const adminSupabase = createAdminClient();

    // 1. Verify Domain Ownership
    const { data: domainTx, error: txErr } = await adminSupabase
      .from("billing_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("transaction_type", "domain_registration")
      .eq("status", "completed")
      .contains("metadata", { domain_name: domainName })
      .maybeSingle();

    if (txErr || !domainTx) {
      return NextResponse.json(
        { error: `Registered domain record for "${domainName}" not found in your account.` },
        { status: 404 }
      );
    }

    const meta = domainTx.metadata || {};
    const orderId = meta.resellerclub_order_id || meta.order_id || `sbx_${domainName}`;
    const currentExpiry = meta.expiry_date ? new Date(meta.expiry_date).getTime() : Date.now();

    // 2. Invoke ResellerClub Domain Renewal
    const renewResult = await renewDomain({
      orderId,
      years,
      currentExpiryTimestamp: currentExpiry,
    });

    if (!renewResult.success) {
      return NextResponse.json(
        { error: renewResult.error || "Failed to renew domain with registry." },
        { status: 502 }
      );
    }

    // 3. Update Expiry Date in Metadata
    const currentExpiryDate = new Date(currentExpiry);
    currentExpiryDate.setFullYear(currentExpiryDate.getFullYear() + years);
    const newExpiryIso = renewResult.newExpiryDate || currentExpiryDate.toISOString();

    await adminSupabase
      .from("billing_transactions")
      .update({
        metadata: {
          ...meta,
          expiry_date: newExpiryIso,
          last_renewed_at: new Date().toISOString(),
          last_renewed_years: years,
        },
      })
      .eq("id", domainTx.id);

    // 4. Log Renewal Billing Transaction
    const { tld } = parseDomainQuery(domainName);
    const pricingMap = await getDomainPricingMap();
    const renewalUnitPrice = (tld && pricingMap[tld]?.renewalPrice) || 1199;
    const totalRenewalAmount = renewalUnitPrice * years;

    await adminSupabase.from("billing_transactions").insert({
      user_id: user.id,
      provider: meta.provider || "resellerclub",
      provider_payment_id: `renew_${orderId}_${Date.now()}`,
      transaction_type: "domain_renewal",
      plan_id: "domain_renewal",
      amount: totalRenewalAmount,
      currency: "INR",
      status: "completed",
      metadata: {
        domain_name: domainName,
        years,
        new_expiry_date: newExpiryIso,
        order_id: orderId,
      },
    });

    return NextResponse.json({
      success: true,
      domain: domainName,
      years,
      newExpiryDate: newExpiryIso,
      message: `Domain ${domainName} successfully renewed for ${years} year${years > 1 ? "s" : ""}!`,
    });
  } catch (err: any) {
    console.error("[Domain Renewal API] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to renew domain." },
      { status: 500 }
    );
  }
}

