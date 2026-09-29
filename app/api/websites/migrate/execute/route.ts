import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { executeWebsiteMigration } from "@/lib/migration/executor";
import { SourceWebsiteScan, MigrationMode, MigrationSelections } from "@/lib/migration/types";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log(`[MIGRATION API] Route invoked at ${new Date().toISOString()}`);

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required to execute website migration." }, { status: 401 });
    }

    const body = await req.json();
    const { scanResult, mode, selections, redesignPrompt, runId: clientRunId } = body as {
      scanResult?: SourceWebsiteScan;
      mode?: MigrationMode;
      selections?: MigrationSelections;
      redesignPrompt?: string;
      runId?: string;
    };

    const runId = clientRunId || `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[MIGRATION API START] runId: ${runId} | mode: ${mode}`);

    if (!scanResult || !scanResult.targetUrl || !scanResult.pages) {
      return NextResponse.json({ error: "Invalid scan result object provided." }, { status: 400 });
    }

    const selectedMode: MigrationMode = mode || "exact";
    const selectedOptions: MigrationSelections = selections || {
      content: { pages: true, blogPages: true, navigation: true, textContent: true, images: true, logo: true, forms: true },
      seo: { pageTitles: true, metaDescriptions: true, canonicalUrls: true, openGraph: true, robotsSettings: true, structuredData: true },
      design: { colors: true, typography: true, spacing: true, layout: true, buttons: true },
    };

    const result = await executeWebsiteMigration(user.id, scanResult, selectedMode, selectedOptions, supabase, redesignPrompt, runId);

    console.log(`[MIGRATION API] Route completed in ${Date.now() - startTime}ms`);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`[MIGRATION API] Route Error (${Date.now() - startTime}ms):`, err);
    return NextResponse.json(
      { error: err?.message || "Failed to execute website migration." },
      { status: 500 }
    );
  }
}
