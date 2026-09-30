import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const urlObj = new URL(req.url);
  const targetUrl = new URL("/api/marketing/callback", urlObj.origin);
  targetUrl.search = urlObj.search;
  return NextResponse.redirect(targetUrl);
}
