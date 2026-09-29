import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { loadMetaConnection, deleteMetaConnection } from "@/lib/marketing/meta-client";

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

    // Verify website ownership
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

    const clientId = (process.env.META_CLIENT_ID || process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || "").trim();
    if (!clientId) {
      console.warn("Meta OAuth Diagnostic:", {
        source: "meta-status",
        reason: "missing_meta_client_id",
      });
    }

    const connection = await loadMetaConnection(supabase, websiteId);

    if (!connection) {
      return NextResponse.json({
        success: true,
        isConnected: false,
        connection: null,
      });
    }

    const isExpired = connection.token_expires_at > 0 && Date.now() >= connection.token_expires_at;

    // Return safe public connection payload (NEVER expose raw/encrypted tokens)
    return NextResponse.json({
      success: true,
      isConnected: connection.status === "connected" && !isExpired,
      connection: {
        provider: connection.provider,
        status: isExpired ? "reauth_required" : connection.status,
        metaUserId: connection.meta_user_id,
        metaUserName: connection.meta_user_name,
        metaUserEmail: connection.meta_user_email,
        grantedScopes: connection.granted_scopes,
        lastSyncedAt: connection.last_synced_at,
        tokenExpiresAt: connection.token_expires_at,
      },
    });
  } catch (error: any) {
    console.error("API /api/websites/[id]/marketing/status GET Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to retrieve Meta connection status." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Verify website ownership
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

    await deleteMetaConnection(supabase, websiteId);

    return NextResponse.json({
      success: true,
      message: "Meta account disconnected successfully.",
    });
  } catch (error: any) {
    console.error("API /api/websites/[id]/marketing/status DELETE Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to disconnect Meta account." },
      { status: 500 }
    );
  }
}
