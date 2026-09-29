import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  getWebsiteMetaAssets,
  setWebsiteMetaSelection,
} from "@/lib/marketing/meta-client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;

    if (!websiteId) {
      return NextResponse.json({ error: "websiteId is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    // Server-side website ownership validation
    const { data: website, error: webErr } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (webErr || !website) {
      return NextResponse.json(
        { error: "Website not found or unauthorized access." },
        { status: 403 }
      );
    }

    const assetData = await getWebsiteMetaAssets(supabase, websiteId);

    return NextResponse.json({
      success: true,
      data: assetData,
    });
  } catch (error: any) {
    console.error("API /api/websites/[id]/marketing/meta/selection GET Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to retrieve Meta asset selections." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: websiteId } = await params;

    if (!websiteId) {
      return NextResponse.json({ error: "websiteId is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    // Server-side website ownership validation
    const { data: website, error: webErr } = await supabase
      .from("websites")
      .select("id")
      .eq("id", websiteId)
      .eq("user_id", user.id)
      .single();

    if (webErr || !website) {
      return NextResponse.json(
        { error: "Website not found or unauthorized access." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { selectedAdAccountId, selectedPageId, selectedInstagramAccountId } = body;

    await setWebsiteMetaSelection(supabase, websiteId, user.id, {
      selectedAdAccountId,
      selectedPageId,
      selectedInstagramAccountId,
    });

    const updatedData = await getWebsiteMetaAssets(supabase, websiteId);

    return NextResponse.json({
      success: true,
      message: "Meta asset selection updated successfully.",
      data: updatedData,
    });
  } catch (error: any) {
    console.error("API /api/websites/[id]/marketing/meta/selection POST Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save Meta asset selection." },
      { status: 500 }
    );
  }
}
