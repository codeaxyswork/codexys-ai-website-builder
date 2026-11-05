import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { getPaymentProvider, isMockPaymentAllowed } from "@/lib/payment-providers";
import { parseDomainQuery, getDomainPricingMap, DomainContactDetails } from "@/lib/resellerclub";
import { APPROVED_DOMAIN_OFFER_POLICY } from "@/lib/billing-periods";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawDomain = String(body.domain || "").trim().toLowerCase();
    const websiteId = body.websiteId ? String(body.websiteId).trim() : null;
    const years = Math.max(1, Math.min(10, parseInt(body.years, 10) || 1));
    const protectPrivacy = Boolean(body.protectPrivacy);
    const rawContact: Partial<DomainContactDetails> = body.contact || {};

    // 1. Domain Format Validation
    const { sld, tld } = parseDomainQuery(rawDomain);
    if (!sld || !tld) {
      return NextResponse.json(
        { error: "Invalid domain format. Please provide a full domain (e.g. mybrand.com)." },
        { status: 400 }
      );
    }
    const fullDomainName = `${sld}.${tld}`;

    // 2. Validate Contact Details
    const contact: DomainContactDetails = {
      name: (rawContact.name || user.user_metadata?.full_name || "Codeaxys Customer").trim(),
      company: (rawContact.company || "").trim(),
      email: (rawContact.email || user.email || "").trim(),
      addressLine1: (rawContact.addressLine1 || "100 Innovation Way").trim(),
      addressLine2: (rawContact.addressLine2 || "").trim(),
      city: (rawContact.city || "Bangalore").trim(),
      state: (rawContact.state || "Karnataka").trim(),
      country: (rawContact.country || "IN").trim().toUpperCase(),
      zipcode: (rawContact.zipcode || "560001").trim(),
      phoneCountryCode: (rawContact.phoneCountryCode || "91").replace(/\+/, "").trim(),
      phone: (rawContact.phone || "9876543210").replace(/\D/g, "").trim(),
    };

    if (!contact.email || !contact.name) {
      return NextResponse.json(
        { error: "Registrant name and valid email are required for domain registration." },
        { status: 400 }
      );
    }

    // 3. Verify Website Ownership if websiteId is passed
    if (websiteId) {
      const { data: website, error: siteErr } = await supabase
        .from("websites")
        .select("id, user_id")
        .eq("id", websiteId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (siteErr || !website) {
        return NextResponse.json(
          { error: "Target website not found or access denied." },
          { status: 404 }
        );
      }
    }

    // 4. Check Free Domain Eligibility under 36-Month Subscription Offer
    const adminSupabase = createAdminClient();
    const { data: subData } = await adminSupabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    const isTriennialSub =
      subData &&
      (subData.billing_interval === "triennial" || subData.duration_months === 36);

    // Check if user has already claimed a free domain under this subscription
    const { data: priorFreeDomainTx } = await adminSupabase
      .from("billing_transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("transaction_type", "domain_registration")
      .contains("metadata", { is_free_domain_offer: true })
      .maybeSingle();

    const isEligibleTld = APPROVED_DOMAIN_OFFER_POLICY.eligibleExtensions.includes(`.${tld}`);
    const isFreeEligible = Boolean(isTriennialSub && !priorFreeDomainTx && isEligibleTld && years === 1);

    // 5. Pricing Calculation
    const pricingMap = await getDomainPricingMap();
    const tldPricing = pricingMap[tld] || {
      registrationPrice: 999,
      renewalPrice: 1299,
      transferPrice: 999,
      currency: "INR",
    };

    const registrationBasePrice = tldPricing.registrationPrice * years;
    const finalAmount = isFreeEligible ? 0 : registrationBasePrice;
    const currency = "INR";

    // 6. Payment Gateway Order Creation
    const provider = getPaymentProvider();

    // Case A: 100% Free Domain Claim (Under 36-Month Subscription)
    if (finalAmount === 0) {
      const freeOrderId = `cx_free_dom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      await adminSupabase.from("billing_transactions").insert({
        user_id: user.id,
        provider: "codeaxys_domain_offer",
        provider_payment_id: freeOrderId,
        transaction_type: "domain_registration_order_created",
        plan_id: subData?.plan_id || "triennial_bundle",
        amount: 0,
        currency,
        status: "pending",
        metadata: {
          order_id: freeOrderId,
          domain_name: fullDomainName,
          sld,
          tld,
          years,
          protect_privacy: protectPrivacy,
          contact_details: contact,
          website_id: websiteId,
          is_free_domain_offer: true,
          provider: "codeaxys_domain_offer",
        },
      });

      return NextResponse.json({
        success: true,
        orderId: freeOrderId,
        amount: 0,
        currency,
        isFreeDomain: true,
        domainName: fullDomainName,
        message: "Free 1st-year domain registration applied under your 36-month subscription offer!",
      });
    }

    // Case B: Mock Gateway Order (Local development / Staging)
    if (provider.name === "mock") {
      if (!isMockPaymentAllowed()) {
        return NextResponse.json(
          { error: "Mock checkout is unavailable in the production environment." },
          { status: 403 }
        );
      }

      const mockOrderId = `rc_dom_order_${Date.now()}`;

      await adminSupabase.from("billing_transactions").insert({
        user_id: user.id,
        provider: "mock",
        provider_payment_id: mockOrderId,
        transaction_type: "domain_registration_order_created",
        plan_id: "domain_registration",
        amount: finalAmount,
        currency,
        status: "pending",
        metadata: {
          order_id: mockOrderId,
          domain_name: fullDomainName,
          sld,
          tld,
          years,
          protect_privacy: protectPrivacy,
          contact_details: contact,
          website_id: websiteId,
          is_free_domain_offer: false,
          provider: "mock",
        },
      });

      return NextResponse.json({
        success: true,
        mode: "mock",
        provider: "mock",
        orderId: mockOrderId,
        amount: finalAmount,
        currency,
        domainName: fullDomainName,
      });
    }

    // Case C: Live Gateway Order (Razorpay / Stripe)
    const orderRes = await provider.createOrder({
      userId: user.id,
      userEmail: user.email || undefined,
      planId: "domain_registration",
      planName: `Domain: ${fullDomainName} (${years} Year${years > 1 ? "s" : ""})`,
      interval: "yearly",
      amount: finalAmount,
      currency,
      metadata: {
        domainName: fullDomainName,
        sld,
        tld,
        years,
        websiteId,
        protectPrivacy,
      },
    });

    if (!orderRes.success) {
      return NextResponse.json(
        { error: orderRes.message || "Failed to initialize payment gateway order." },
        { status: 400 }
      );
    }

    await adminSupabase.from("billing_transactions").insert({
      user_id: user.id,
      provider: provider.name,
      provider_payment_id: orderRes.orderId,
      transaction_type: "domain_registration_order_created",
      plan_id: "domain_registration",
      amount: finalAmount,
      currency,
      status: "pending",
      metadata: {
        order_id: orderRes.orderId,
        domain_name: fullDomainName,
        sld,
        tld,
        years,
        protect_privacy: protectPrivacy,
        contact_details: contact,
        website_id: websiteId,
        is_free_domain_offer: false,
        provider: provider.name,
      },
    });

    return NextResponse.json({
      success: true,
      mode: orderRes.mode,
      provider: provider.name,
      orderId: orderRes.orderId,
      amount: orderRes.amount,
      currency: orderRes.currency,
      keyId: orderRes.keyId,
      domainName: fullDomainName,
    });
  } catch (err: any) {
    console.error("[Domain Checkout API] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process domain purchase checkout." },
      { status: 500 }
    );
  }
}

