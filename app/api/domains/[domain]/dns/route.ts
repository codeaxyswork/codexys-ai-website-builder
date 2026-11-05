import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import {
  getDomainDetails,
  updateDomainNameservers,
  DEFAULT_NAMESERVERS,
  DnsRecord,
} from "@/lib/resellerclub";

export async function GET(
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

    const adminSupabase = createAdminClient();

    // Verify User Owns Domain (either registered or connected to their website)
    const [txRes, siteRes] = await Promise.all([
      adminSupabase
        .from("billing_transactions")
        .select("metadata")
        .eq("user_id", user.id)
        .eq("transaction_type", "domain_registration")
        .eq("status", "completed")
        .contains("metadata", { domain_name: domainName })
        .maybeSingle(),
      adminSupabase
        .from("websites")
        .select("id, custom_domain")
        .eq("user_id", user.id)
        .eq("custom_domain", domainName)
        .maybeSingle(),
    ]);

    if (!txRes.data && !siteRes.data) {
      return NextResponse.json(
        { error: `Domain "${domainName}" not associated with your account.` },
        { status: 404 }
      );
    }

    const details = await getDomainDetails(domainName);
    const storedMeta = txRes.data?.metadata || {};
    const customDnsRecords: DnsRecord[] = storedMeta.dns_records || [
      { id: "1", type: "A", host: "@", value: "76.76.21.21", ttl: 3600 },
      { id: "2", type: "CNAME", host: "www", value: "cname.codeaxys.com", ttl: 3600 },
    ];

    return NextResponse.json({
      success: true,
      domain: domainName,
      nameservers: details?.nameservers || storedMeta.nameservers || DEFAULT_NAMESERVERS,
      dnsRecords: customDnsRecords,
      details,
    });
  } catch (err: any) {
    console.error("[Domain DNS GET API] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to retrieve DNS settings." },
      { status: 500 }
    );
  }
}

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
    const adminSupabase = createAdminClient();

    // Verify Domain Ownership
    const { data: domainTx } = await adminSupabase
      .from("billing_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("transaction_type", "domain_registration")
      .eq("status", "completed")
      .contains("metadata", { domain_name: domainName })
      .maybeSingle();

    if (!domainTx) {
      return NextResponse.json(
        { error: `Domain "${domainName}" is not registered in your account.` },
        { status: 404 }
      );
    }

    const meta = domainTx.metadata || {};
    const orderId = meta.resellerclub_order_id || meta.order_id || "";

    // Action 1: Update Nameservers
    if (body.action === "update_nameservers" && Array.isArray(body.nameservers)) {
      const newNs = body.nameservers.filter((n: string) => typeof n === "string" && n.trim().length > 0);
      if (newNs.length < 2) {
        return NextResponse.json(
          { error: "At least two valid nameservers are required." },
          { status: 400 }
        );
      }

      if (orderId) {
        await updateDomainNameservers(orderId, newNs);
      }

      await adminSupabase
        .from("billing_transactions")
        .update({
          metadata: {
            ...meta,
            nameservers: newNs,
            nameservers_updated_at: new Date().toISOString(),
          },
        })
        .eq("id", domainTx.id);

      return NextResponse.json({
        success: true,
        message: "Nameservers successfully updated.",
        nameservers: newNs,
      });
    }

    // Action 2: Add / Save DNS Record
    if (body.action === "add_record" && body.record) {
      const record: DnsRecord = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: body.record.type || "A",
        host: (body.record.host || "@").trim(),
        value: (body.record.value || "").trim(),
        ttl: parseInt(body.record.ttl, 10) || 3600,
        priority: body.record.priority ? parseInt(body.record.priority, 10) : undefined,
      };

      if (!record.value) {
        return NextResponse.json({ error: "Record value is required." }, { status: 400 });
      }

      const existingRecords: DnsRecord[] = meta.dns_records || [
        { id: "1", type: "A", host: "@", value: "76.76.21.21", ttl: 3600 },
        { id: "2", type: "CNAME", host: "www", value: "cname.codeaxys.com", ttl: 3600 },
      ];

      const updatedRecords = [...existingRecords, record];

      await adminSupabase
        .from("billing_transactions")
        .update({
          metadata: {
            ...meta,
            dns_records: updatedRecords,
          },
        })
        .eq("id", domainTx.id);

      return NextResponse.json({
        success: true,
        message: "DNS record added successfully.",
        record,
        dnsRecords: updatedRecords,
      });
    }

    return NextResponse.json({ error: "Unknown action specified." }, { status: 400 });
  } catch (err: any) {
    console.error("[Domain DNS POST API] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update DNS settings." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get("recordId");

    if (!recordId) {
      return NextResponse.json({ error: "Missing recordId parameter." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const { data: domainTx } = await adminSupabase
      .from("billing_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("transaction_type", "domain_registration")
      .eq("status", "completed")
      .contains("metadata", { domain_name: domainName })
      .maybeSingle();

    if (!domainTx) {
      return NextResponse.json(
        { error: `Domain "${domainName}" not found.` },
        { status: 404 }
      );
    }

    const meta = domainTx.metadata || {};
    const existingRecords: DnsRecord[] = meta.dns_records || [];
    const filtered = existingRecords.filter((r) => r.id !== recordId);

    await adminSupabase
      .from("billing_transactions")
      .update({
        metadata: {
          ...meta,
          dns_records: filtered,
        },
      })
      .eq("id", domainTx.id);

    return NextResponse.json({
      success: true,
      message: "DNS record removed.",
      dnsRecords: filtered,
    });
  } catch (err: any) {
    console.error("[Domain DNS DELETE API] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete DNS record." },
      { status: 500 }
    );
  }
}

