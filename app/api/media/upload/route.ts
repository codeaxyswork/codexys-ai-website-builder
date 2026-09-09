import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { FILE_LIMITS, ERROR_CODES } from "@/lib/constants";
import { getUserUsage } from "@/lib/billing";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const websiteId = (formData.get("websiteId") as string) || null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided for upload." },
        { status: 400 }
      );
    }

    // 1. Validate file format
    if (!FILE_LIMITS.ALLOWED_MIME_TYPES.includes(file.type as any)) {
      return NextResponse.json(
        {
          error: ERROR_CODES.INVALID_FILE_TYPE,
          message: "Only image formats (JPEG, PNG, WebP, SVG) are allowed.",
        },
        { status: 400 }
      );
    }

    // 2. Validate max file size (5 MB)
    if (file.size > FILE_LIMITS.MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: ERROR_CODES.FILE_TOO_LARGE,
          message: "File size exceeds the 5 MB maximum limit.",
        },
        { status: 400 }
      );
    }

    // 3. Validate user storage quota
    const usage = await getUserUsage(user.id);
    if (usage) {
      const projectedStorage = usage.storage.usedBytes + file.size;
      if (projectedStorage > usage.storage.limitBytes) {
        return NextResponse.json(
          {
            error: ERROR_CODES.STORAGE_LIMIT_REACHED,
            message: "You have reached your plan's storage limit. Please upgrade your plan to upload more assets.",
          },
          { status: 400 }
        );
      }
    }

    // 4. Generate Storage Path & Upload to Supabase Storage bucket 'website-assets'
    const sanitizeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${user.id}/${websiteId || "general"}/${Date.now()}_${sanitizeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("website-assets")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    let publicUrl = "";
    if (!uploadError) {
      const { data: publicData } = supabase.storage
        .from("website-assets")
        .getPublicUrl(storagePath);
      publicUrl = publicData?.publicUrl || "";
    }

    // 5. Insert metadata row into public.media_assets table
    const { data: assetRow, error: dbError } = await supabase
      .from("media_assets")
      .insert({
        user_id: user.id,
        website_id: websiteId,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        storage_path: storagePath,
        public_url: publicUrl,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Media Asset DB Insert Error:", dbError);
    }

    return NextResponse.json({
      success: true,
      asset: {
        id: assetRow?.id || `asset_${Date.now()}`,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        public_url: publicUrl,
      },
    });
  } catch (err: any) {
    console.error("Media Upload API Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process media upload." },
      { status: 500 }
    );
  }
}
