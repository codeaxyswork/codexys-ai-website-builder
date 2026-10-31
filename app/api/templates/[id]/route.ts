import { NextRequest, NextResponse } from "next/server";
import { isValidTemplateId } from "../../../../lib/auth-redirect";
import { loadTemplateFromDisk } from "../../../../lib/template-loader";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Sanitize & validate template identifier
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Template identifier is required." },
        { status: 400 }
      );
    }

    const cleanId = id.trim().toLowerCase();

    // 2. Reject path traversal or illegal characters
    if (cleanId.includes("..") || cleanId.includes("/") || cleanId.includes("\\")) {
      return NextResponse.json(
        { error: "Invalid template identifier format." },
        { status: 400 }
      );
    }

    if (!isValidTemplateId(cleanId)) {
      return NextResponse.json(
        { error: `Template '${cleanId}' is not recognized.` },
        { status: 404 }
      );
    }

    // 3. Load complete template package from disk
    const payload = await loadTemplateFromDisk(cleanId);

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Failed to load template.";
    console.error("Template Ingestion API Error:", errorMsg);

    const status = errorMsg.includes("not found") ? 404 : 500;

    return NextResponse.json(
      { error: "Could not load the requested template." },
      { status }
    );
  }
}
