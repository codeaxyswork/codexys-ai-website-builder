import { NextResponse } from "next/server";
import { getDomainPricingMap, DEFAULT_SUPPORTED_TLDS } from "@/lib/resellerclub";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pricingMap = await getDomainPricingMap();

    const tldsList = DEFAULT_SUPPORTED_TLDS.map((item) => {
      const livePricing = pricingMap[item.tld];
      return {
        ...item,
        registrationPrice: livePricing?.registrationPrice || item.registrationPrice,
        renewalPrice: livePricing?.renewalPrice || item.renewalPrice,
        transferPrice: livePricing?.transferPrice || item.transferPrice,
      };
    });

    return NextResponse.json({
      success: true,
      currency: "INR",
      tlds: tldsList,
      count: tldsList.length,
    });
  } catch (err: any) {
    console.error("[Domain Pricing API] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to retrieve domain pricing." },
      { status: 500 }
    );
  }
}

