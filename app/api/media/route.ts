import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    const { data: rawAssets, error } = await adminClient
      .from("media_assets")
      .select("id, file_name, file_size_bytes, mime_type, storage_path, public_url, created_at, website_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch media assets error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const validAssets: any[] = [];
    const dbUpdates: Promise<any>[] = [];

    for (const asset of rawAssets || []) {
      let resolvedUrl = typeof asset.public_url === "string" ? asset.public_url.trim() : "";

      // If public_url is missing or not a valid http URL, try resolving via storage_path
      if ((!resolvedUrl || !resolvedUrl.startsWith("http")) && asset.storage_path) {
        try {
          const { data: publicData } = adminClient.storage
            .from("website-assets")
            .getPublicUrl(asset.storage_path);

          if (publicData?.publicUrl && publicData.publicUrl.startsWith("http")) {
            resolvedUrl = publicData.publicUrl;
            // Backfill DB row asynchronously without blocking or failing GET response
            Promise.resolve(
              adminClient
                .from("media_assets")
                .update({ public_url: resolvedUrl })
                .eq("id", asset.id)
            ).catch((backfillErr: any) => {
              console.warn("Background public_url backfill non-fatal warning:", backfillErr);
            });
          }
        } catch (err) {
          console.warn("Storage URL resolution warning for asset:", asset.id, err);
        }
      }

      // Only return asset if it has a valid, usable http/https URL
      if (resolvedUrl && resolvedUrl.startsWith("http")) {
        validAssets.push({
          ...asset,
          public_url: resolvedUrl,
        });
      }
    }

    return NextResponse.json({ assets: validAssets });
  } catch (err: any) {
    console.error("Get Media API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch media assets." },
      { status: 500 }
    );
  }
}
