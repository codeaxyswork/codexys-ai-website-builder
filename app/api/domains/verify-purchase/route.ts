import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { getPaymentProvider, isMockPaymentAllowed } from "@/lib/payment-providers";
import { registerDomain } from "@/lib/resellerclub";
import { addDomainToVercel } from "@/lib/domain-verification";
import { invalidateUserCache } from "@/lib/cache";

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
    const orderId = String(body.orderId || body.razorpay_order_id || "").trim();
    const paymentId = String(body.paymentId || body.razorpay_payment_id || orderId).trim();
    const signature = String(body.signature || body.razorpay_signature || "").trim();

    if (!orderId) {
      return NextResponse.json(
        { error: "Missing required order identifier." },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // 1. Idempotency Check: verify if already completed
    const { data: existingCompletedTx } = await adminSupabase
      .from("billing_transactions")
      .select("id, status, user_id, metadata")
      .eq("provider_payment_id", paymentId)
      .eq("status", "completed")
      .maybeSingle();

    if (existingCompletedTx) {
      if (existingCompletedTx.user_id !== user.id) {
        return NextResponse.json(
          { error: "Payment verification ownership mismatch." },
          { status: 403 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "Domain purchase has already been verified and processed.",
        domainName: existingCompletedTx.metadata?.domain_name,
        idempotent: true,
      });
    }

    // 2. Fetch Stored Pending Transaction
    const { data: pendingTx, error: pendingErr } = await adminSupabase
      .from("billing_transactions")
      .select("*")
      .eq("provider_payment_id", orderId)
      .eq("transaction_type", "domain_registration_order_created")
      .maybeSingle();

    if (pendingErr || !pendingTx) {
      return NextResponse.json(
        { error: "Pending domain registration order not found." },
        { status: 404 }
      );
    }

    // 3. User Ownership Validation
    if (pendingTx.user_id !== user.id) {
      return NextResponse.json(
        { error: "Security Alert: Order does not belong to authenticated user." },
        { status: 403 }
      );
    }

    const txMeta = pendingTx.metadata || {};
    const domainName = String(txMeta.domain_name || "").toLowerCase().trim();
    const years = parseInt(txMeta.years, 10) || 1;
    const contactDetails = txMeta.contact_details;
    const websiteId = txMeta.website_id;
    const isFreeDomain = Boolean(txMeta.is_free_domain_offer);

    // 4. Payment Verification (Independent Verification)
    const provider = getPaymentProvider();

    if (isFreeDomain) {
      // Free eligible domain under 36-month offer: no gateway payment needed
    } else if (provider.name === "mock") {
      if (!isMockPaymentAllowed()) {
        return NextResponse.json(
          { error: "Mock payment verification forbidden in production." },
          { status: 403 }
        );
      }
    } else {
      // Live gateway verification (Razorpay / Stripe)
      const verifyRes = await provider.verifyPayment({
        orderId,
        paymentId,
        signature,
      });

      const isVerified = typeof verifyRes === "boolean" ? verifyRes : verifyRes.verified;
      if (!isVerified) {
        return NextResponse.json(
          { error: "Payment verification signature check failed." },
          { status: 400 }
        );
      }
    }

    // 5. Register Domain in ResellerClub
    // Requirement: "Never mark a domain as registered until ResellerClub confirms successful registration."
    const registrationResult = await registerDomain({
      domainName,
      years,
      contactDetails,
      protectPrivacy: Boolean(txMeta.protect_privacy),
    });

    if (!registrationResult.success) {
      console.error("[ResellerClub Registration Failed]", registrationResult.error);
      // Mark transaction as failed or pending manual review so user is protected
      await adminSupabase
        .from("billing_transactions")
        .update({
          status: "failed",
          metadata: {
            ...txMeta,
            registration_error: registrationResult.error,
            registration_attempted_at: new Date().toISOString(),
          },
        })
        .eq("id", pendingTx.id);

      return NextResponse.json(
        {
          error: `Domain registration could not be completed with registry: ${
            registrationResult.error || "Registry rejected request."
          }`,
          code: "REGISTRATION_PROVIDER_ERROR",
        },
        { status: 502 }
      );
    }

    // 6. Registration Confirmed! Record Completed Transaction
    const nowIso = new Date().toISOString();
    const expiryIso = registrationResult.expiryDate || new Date(Date.now() + years * 365 * 24 * 3600 * 1000).toISOString();

    const { error: updateTxErr } = await adminSupabase
      .from("billing_transactions")
      .update({
        status: "completed",
        transaction_type: "domain_registration",
        provider_payment_id: paymentId,
        metadata: {
          ...txMeta,
          resellerclub_order_id: registrationResult.orderId,
          resellerclub_entity_id: registrationResult.entityId,
          registration_date: nowIso,
          expiry_date: expiryIso,
          auto_renew: true,
          status: "active",
          resellerclub_mode: registrationResult.mode,
        },
      })
      .eq("id", pendingTx.id);

    if (updateTxErr) {
      console.error("[Domain Transaction Update Error]", updateTxErr);
    }

    // 7. Associate with Website if specified
    if (websiteId) {
      const { data: website } = await adminSupabase
        .from("websites")
        .select("id, custom_domain")
        .eq("id", websiteId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (website) {
        // Automatically verify and link custom domain
        await adminSupabase
          .from("websites")
          .update({
            custom_domain: domainName,
            custom_domain_verified: true,
            custom_domain_status: "ready",
            custom_domain_verified_at: nowIso,
            www_domain_configured: true,
          })
          .eq("id", websiteId);

        // Auto-provision Vercel edge routing for the domain
        try {
          await addDomainToVercel(domainName);
          await addDomainToVercel(`www.${domainName}`);
        } catch (vercelErr) {
          console.warn("[Vercel Custom Domain Registration Warning]", vercelErr);
        }
      }
    }

    // 8. Invalidate User Cache
    await invalidateUserCache(user.id);

    return NextResponse.json({
      success: true,
      domainName,
      orderId: registrationResult.orderId,
      expiryDate: expiryIso,
      websiteId,
      message: `Congratulations! ${domainName} has been successfully registered and connected to your account.`,
    });
  } catch (err: any) {
    console.error("[Domain Verify Purchase API] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to finalize domain registration purchase." },
      { status: 500 }
    );
  }
}

