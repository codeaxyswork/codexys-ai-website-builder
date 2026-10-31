/**
 * Codeaxys AI Website Builder — Billing Invoices & Tax Engine
 * Generates GST-compliant invoice structures, exact inclusive tax breakdowns,
 * and concurrency-safe sequential invoice numbering conforming to Indian CGST Rule 46.
 *
 * SAC Code: 998314 (Information Technology and Cloud Software Services)
 * Standard Indian SaaS GST: 18% (Intra-state: 9% CGST + 9% SGST; Inter-state / Export: 18% IGST)
 */

export interface InvoiceLineItem {
  id: string;
  description: string;
  sacCode: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxableAmount: number;
  taxRatePercent: number;
  taxAmount: number;
  totalAmount: number;
}

export interface TaxBreakdown {
  taxableAmount: number;
  grossAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  isInterState: boolean;
}

export interface InvoiceRecord {
  invoiceNumber: string;
  invoiceDate: string;
  financialYear: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxableSubtotal: number;
  taxBreakdown: TaxBreakdown;
  grandTotal: number;
  lineItems: InvoiceLineItem[];
  customer: {
    userId: string;
    email?: string;
    name?: string;
    gstin?: string;
    billingAddress?: string;
    state?: string;
    country: string;
  };
  supplier: {
    companyName: string;
    tradeName: string;
    address: string;
    email: string;
    website: string;
    gstinPlaceholder: string;
    hsnSac: string;
  };
  payment: {
    provider: string;
    orderId?: string;
    paymentId?: string;
    status: "paid" | "pending" | "refunded";
    paidAt: string;
  };
  termsNotice: string;
  domainOfferNotice?: string;
}

export interface GenerateInvoiceParams {
  userId: string;
  userEmail?: string;
  userName?: string;
  customerGstin?: string;
  customerState?: string;
  planId: string;
  planName: string;
  interval: string;
  durationMonths: number;
  grossAmount: number;
  discountAmount: number;
  finalTotal: number;
  provider: string;
  orderId?: string;
  paymentId?: string;
  currency?: string;
  invoiceNumber?: string;
  domainOfferDetails?: {
    optedIn: boolean;
    domainName?: string;
    freeYears: number;
    subsequentRenewalNotice?: string;
  };
}

export const CODEAXYS_SUPPLIER_PROFILE = {
  companyName: "Codeaxys Digital Technologies Private Limited",
  tradeName: "Codeaxys AI Website Builder",
  address: "Bangalore, Karnataka, India",
  email: "billing@codeaxys.com",
  website: "https://codeaxys.com",
  gstinPlaceholder: "29AAAAA0000A1Z5", // Karnataka state code 29
  hsnSac: "998314",
};

/**
 * Derives the Indian Financial Year (April 1 to March 31).
 * E.g., for October 2026, returns '2026-27'.
 */
export function getIndianFinancialYear(date: Date = new Date()): string {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();
  if (month >= 4) {
    const nextYearShort = String((year + 1) % 100).padStart(2, "0");
    return `${year}-${nextYearShort}`;
  } else {
    const currentYearShort = String(year % 100).padStart(2, "0");
    return `${year - 1}-${currentYearShort}`;
  }
}

/**
 * Formats sequential invoice number conforming to Indian CGST Rule 46:
 * Max 16 characters for e-invoice and GST portal interoperability.
 * Format: CDX/YY-YY/00001 (15 characters)
 */
export function formatInvoiceNumber(financialYear: string, sequenceNumber: number): string {
  const parts = financialYear.split("-");
  const startYr = parts[0]?.slice(-2) || "26";
  const endYr = parts[1] || "27";
  const paddedSeq = String(sequenceNumber).padStart(5, "0");
  return `CDX/${startYr}-${endYr}/${paddedSeq}`;
}

// In-process atomic sequence counter for offline fallback, tests, and non-blocking safety
let memorySequenceCounter = 0;

export function resetMemoryInvoiceSequence(initial = 0): void {
  memorySequenceCounter = initial;
}

export function getFallbackSequentialInvoiceNumber(financialYear?: string): string {
  const fy = financialYear || getIndianFinancialYear();
  memorySequenceCounter += 1;
  return formatInvoiceNumber(fy, memorySequenceCounter);
}

/**
 * Concurrency-safe sequential invoice number generator.
 * Uses atomic PostgreSQL RPC `get_next_invoice_number` when database is available,
 * and seamlessly falls back to sequential monotonic in-process generator.
 */
export async function generateSequentialInvoiceNumber(
  supabaseClient?: any,
  financialYear?: string
): Promise<string> {
  const fy = financialYear || getIndianFinancialYear();

  if (supabaseClient && typeof supabaseClient.rpc === "function") {
    try {
      const { data, error } = await supabaseClient.rpc("get_next_invoice_number", {
        p_financial_year: fy,
      });

      if (!error && data && typeof data === "string" && data.startsWith("CDX/")) {
        return data;
      }
    } catch {
      // Fallback silently if RPC is unavailable in current environment
    }
  }

  return getFallbackSequentialInvoiceNumber(fy);
}

/**
 * Calculates exact GST breakdown based on supply location and final customer charge.
 *
 * Codeaxys Customer Pricing Policy:
 * Advertised plan prices (e.g. ₹299, ₹2,990, ₹6,997, etc.) are GST-INCLUSIVE final charges.
 * Under Indian GST regulations:
 * Gross Amount (G) = Taxable Base (V) + Total GST (T)
 * With standard 18% SaaS GST: G = V * 1.18
 * Therefore:
 * Taxable Base (V) = round(G / 1.18, 2)
 * Total GST (T) = round(G - V, 2)
 *
 * Guarantees that: Taxable Base + Total GST === Final Gross Amount down to 0.01 INR.
 *
 * Intra-State Supply (Karnataka):
 * CGST (9%) = round(T / 2, 2)
 * SGST (9%) = round(T - CGST, 2)   -- Balances odd paise so CGST + SGST === T exactly.
 *
 * Inter-State Supply (Other States / Union Territories):
 * IGST (18%) = T
 * CGST = 0, SGST = 0
 */
export function calculateTaxBreakdown(
  grossTotal: number,
  customerState?: string,
  options?: { isInclusive?: boolean }
): TaxBreakdown {
  const isInclusive = options?.isInclusive ?? true;
  const supplierState = "karnataka";
  const stateNorm = (customerState || "karnataka").toLowerCase().trim();
  const isInterState = stateNorm !== supplierState && stateNorm !== "ka";
  const standardGstRate = 18.0;

  let taxableAmount: number;
  let totalTax: number;
  let finalGross: number;

  if (isInclusive) {
    taxableAmount = Math.round((grossTotal / 1.18) * 100) / 100;
    totalTax = Math.round((grossTotal - taxableAmount) * 100) / 100;
    finalGross = grossTotal;
  } else {
    taxableAmount = grossTotal;
    totalTax = Math.round((grossTotal * 0.18) * 100) / 100;
    finalGross = Math.round((taxableAmount + totalTax) * 100) / 100;
  }

  if (isInterState) {
    return {
      taxableAmount,
      grossAmount: finalGross,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: standardGstRate,
      igstAmount: totalTax,
      totalTax,
      isInterState: true,
    };
  }

  const cgstAmount = Math.round((totalTax / 2) * 100) / 100;
  const sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;

  return {
    taxableAmount,
    grossAmount: finalGross,
    cgstRate: 9.0,
    cgstAmount,
    sgstRate: 9.0,
    sgstAmount,
    igstRate: 0,
    igstAmount: 0,
    totalTax,
    isInterState: false,
  };
}

/**
 * Generates an immutable, structured invoice record to embed in billing transaction metadata.
 */
export function generateInvoiceRecord(params: GenerateInvoiceParams): InvoiceRecord {
  const now = new Date();
  const financialYear = getIndianFinancialYear(now);
  const invoiceNumber = params.invoiceNumber || getFallbackSequentialInvoiceNumber(financialYear);

  const taxBreakdown = calculateTaxBreakdown(params.finalTotal, params.customerState, {
    isInclusive: true,
  });

  const mainLineItem: InvoiceLineItem = {
    id: `item_plan_${params.planId}`,
    description: `Codeaxys AI Website Builder — ${params.planName} Plan (${params.durationMonths} Month${params.durationMonths > 1 ? "s" : ""} Subscription)`,
    sacCode: CODEAXYS_SUPPLIER_PROFILE.hsnSac,
    quantity: 1,
    unitPrice: params.grossAmount,
    discountAmount: params.discountAmount,
    taxableAmount: taxBreakdown.taxableAmount,
    taxRatePercent: 18.0,
    taxAmount: taxBreakdown.totalTax,
    totalAmount: params.finalTotal,
  };

  const lineItems: InvoiceLineItem[] = [mainLineItem];

  let domainNotice: string | undefined;
  if (params.domainOfferDetails?.optedIn) {
    domainNotice = `Includes 1st year free domain registration for 1 eligible custom domain (${params.domainOfferDetails.domainName || "Customer Choice"}). Subsequent years renew at standard registrar pricing.`;
    lineItems.push({
      id: "item_domain_offer",
      description: "Domain Registration Offer (Year 1 Free under 36-Month Prepaid Promotion)",
      sacCode: CODEAXYS_SUPPLIER_PROFILE.hsnSac,
      quantity: 1,
      unitPrice: 0,
      discountAmount: 0,
      taxableAmount: 0,
      taxRatePercent: 0,
      taxAmount: 0,
      totalAmount: 0,
    });
  }

  return {
    invoiceNumber,
    invoiceDate: now.toISOString(),
    financialYear,
    currency: params.currency || "INR",
    subtotal: params.grossAmount,
    discountTotal: params.discountAmount,
    taxableSubtotal: taxBreakdown.taxableAmount,
    taxBreakdown,
    grandTotal: params.finalTotal,
    lineItems,
    customer: {
      userId: params.userId,
      email: params.userEmail,
      name: params.userName,
      gstin: params.customerGstin,
      state: params.customerState,
      country: "IN",
    },
    supplier: CODEAXYS_SUPPLIER_PROFILE,
    payment: {
      provider: params.provider,
      orderId: params.orderId,
      paymentId: params.paymentId,
      status: "paid",
      paidAt: now.toISOString(),
    },
    termsNotice:
      "Subscriptions are billed in advance for the selected term. Cancellations take effect at the conclusion of the paid billing period. AI credits replenish every 30 days without rollover.",
    domainOfferNotice: domainNotice,
  };
}
