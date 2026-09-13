import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { enqueueSEOJob, processSEOJob } from "@/lib/seo-job-processor";

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

    const { data: jobs } = await supabase
      .from("seo_analysis_jobs")
      .select("*")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({ jobs: jobs || [] });
  } catch (err: any) {
    console.error("GET SEO Jobs API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch SEO jobs." },
      { status: 500 }
    );
  }
}

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

    const body = await request.json().catch(() => ({}));
    const triggerType = body.trigger_type || "manual";
    const idempotencyKey = body.idempotency_key || `manual_${websiteId}_${Date.now()}`;

    // Enqueue job
    const { job, deduplicated } = await enqueueSEOJob(supabase, {
      websiteId,
      userId: user.id,
      triggerType,
      idempotencyKey,
    });

    // Auto-process job if status is queued
    let processResult = null;
    if (job && job.status === "queued") {
      processResult = await processSEOJob(supabase, job.id);
    }

    return NextResponse.json({
      job,
      deduplicated,
      processResult,
      message: deduplicated ? "Existing job returned." : "SEO Job enqueued and processed.",
    });
  } catch (err: any) {
    console.error("POST SEO Jobs API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create SEO job." },
      { status: 500 }
    );
  }
}
