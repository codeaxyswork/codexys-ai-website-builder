import { NextResponse } from "next/server";
import { checkDomainAvailability, parseDomainQuery } from "@/lib/resellerclub";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || searchParams.get("q") || "";
    const tldParam = searchParams.get("tlds");

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters long." },
        { status: 400 }
      );
    }

    const { sld } = parseDomainQuery(query);
    if (!sld || sld.length < 2) {
      return NextResponse.json(
        { error: "Invalid domain search term." },
        { status: 400 }
      );
    }

    let tlds: string[] | undefined;
    if (tldParam) {
      tlds = tldParam.split(",").map((t) => t.trim().replace(/^\./, ""));
    }

    const results = await checkDomainAvailability(sld, tlds);

    return NextResponse.json({
      success: true,
      query: sld,
      count: results.length,
      results,
    });
  } catch (err: any) {
    console.error("[Domain Search API] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to check domain availability." },
      { status: 500 }
    );
  }
}

