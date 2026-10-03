import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { FILE_LIMITS, ERROR_CODES } from "@/lib/constants";
import { getUserUsage } from "@/lib/billing";
import { invalidateUserCache } from "@/lib/cache";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();

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

    // 4. Generate unique storage path and buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileExt = file.name.split(".").pop() || "png";
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = websiteId
      ? `${websiteId}/${Date.now()}_${sanitizedFileName}`
      : `${user.id}/${Date.now()}_${sanitizedFileName}`;

    // Ensure bucket 'website-assets' exists before uploading
    try {
      const { data: buckets } = await adminClient.storage.listBuckets();
      const bucketExists = buckets?.some((b: any) => b.name === "website-assets" || b.id === "website-assets");
      if (!bucketExists) {
        await adminClient.storage.createBucket("website-assets", { public: true });
      }
    } catch (err) {
      console.warn("Storage bucket auto-creation warning:", err);
    }

    const { error: uploadError } = await adminClient.storage
      .from("website-assets")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase Storage upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Failed to upload file to storage." },
        { status: 500 }
      );
    }

    const { data: publicData } = adminClient.storage
      .from("website-assets")
      .getPublicUrl(storagePath);
    const publicUrl = publicData?.publicUrl || "";

    if (!publicUrl || !publicUrl.startsWith("http")) {
      return NextResponse.json(
        { error: "Failed to generate public URL for uploaded media." },
        { status: 500 }
      );
    }

    // 5. Insert metadata row into public.media_assets table
    const { data: assetRow, error: dbError } = await adminClient
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
      return NextResponse.json(
        { error: dbError.message || "Failed to save media metadata." },
        { status: 500 }
      );
    }

    // Invalidate user usage cache so dashboard immediately reflects new storage size
    await invalidateUserCache(user.id);

    return NextResponse.json({
      success: true,
      asset: {
        id: assetRow.id,
        file_name: assetRow.file_name || file.name,
        file_size_bytes: assetRow.file_size_bytes || file.size,
        mime_type: assetRow.mime_type || file.type,
        public_url: assetRow.public_url || publicUrl,
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
