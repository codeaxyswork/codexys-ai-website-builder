import dns from "node:dns/promises";
import { normalizeCustomDomainInput, NormalizedDomainResult } from "./domain-resolver";

export type DomainStatus =
  | "none"
  | "pending_dns"
  | "dns_configured"
  | "verifying"
  | "verified"
  | "ssl_pending"
  | "ready"
  | "error";

export interface DnsRecordRequirement {
  host: string;
  value: string;
  type?: "A" | "CNAME" | "TXT";
}

export interface DomainVerificationResult {
  verified: boolean;
  status: DomainStatus;
  message: string;
  dnsRecordsRequired: {
    cname: DnsRecordRequirement;
    aRecord: DnsRecordRequirement;
    txtRecord?: DnsRecordRequirement;
  };
  dnsChecks?: {
    apexIpMatch: boolean;
    apexIps: string[];
    expectedIp: string;
    wwwMatch?: boolean;
    wwwTarget?: string[];
    expectedCname?: string;
  };
  sslReady?: boolean;
  vercelVerified?: boolean;
}

export function sanitizeDomain(input: string): string {
  const norm = normalizeCustomDomainInput(input);
  return norm.isValid ? norm.canonicalDomain : (input || "").trim().toLowerCase();
}

export function isValidDomain(domain: string): boolean {
  const norm = normalizeCustomDomainInput(domain);
  return norm.isValid;
}

// ============================================================================
// VERCEL INTEGRATION HELPERS
// ============================================================================

function getVercelHeaders() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function getVercelTeamParam(): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

/**
 * Attaches a custom domain to the Vercel project dynamically.
 * Completely idempotent: handles already-existing domain gracefully.
 */
export async function addDomainToVercel(
  domain: string,
  redirectTarget?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const headers = getVercelHeaders();
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!headers || !projectId) {
    return {
      success: false,
      error: "Vercel integration credentials not configured on server.",
    };
  }

  try {
    const body: Record<string, any> = { name: domain };
    if (redirectTarget) {
      body.redirect = redirectTarget;
      body.redirectStatusCode = 308;
    }

    const res = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/domains${getVercelTeamParam()}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();

    // 200 = added, 409 / domain_already_in_use = already attached
    if (res.ok) {
      return { success: true, data };
    }

    if (res.status === 409 || data.error?.code === "domain_already_in_use") {
      return { success: true, data };
    }

    return {
      success: false,
      error: data.error?.message || `Vercel domain addition failed (${res.status})`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to communicate with Vercel API.",
    };
  }
}

/**
 * Detaches a custom domain from the Vercel project.
 */
export async function removeDomainFromVercel(
  domain: string
): Promise<{ success: boolean; error?: string }> {
  const headers = getVercelHeaders();
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!headers || !projectId) {
    return { success: true };
  }

  try {
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}${getVercelTeamParam()}`,
      {
        method: "DELETE",
        headers,
      }
    );

    if (res.ok || res.status === 404) {
      return { success: true };
    }

    const data = await res.json();
    return {
      success: false,
      error: data.error?.message || `Failed to remove domain from Vercel (${res.status})`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to communicate with Vercel API.",
    };
  }
}

/**
 * Dynamically queries Vercel for the exact DNS configuration required for a domain.
 * Never hardcodes codexys-ai-website-builder.vercel.app.
 */
export async function getVercelDomainConfig(domain: string): Promise<{
  recommendedIPv4: string;
  recommendedCNAME: string;
  misconfigured: boolean;
  rawConfig?: any;
}> {
  const defaultA = "76.76.21.21";
  const defaultCname = "cname.vercel-dns.com";

  const headers = getVercelHeaders();
  if (!headers) {
    return {
      recommendedIPv4: defaultA,
      recommendedCNAME: defaultCname,
      misconfigured: true,
    };
  }

  try {
    const res = await fetch(
      `https://api.vercel.com/v6/domains/${encodeURIComponent(domain)}/config${getVercelTeamParam()}`,
      { headers }
    );

    if (!res.ok) {
      return {
        recommendedIPv4: defaultA,
        recommendedCNAME: defaultCname,
        misconfigured: true,
      };
    }

    const data = await res.json();

    // Extract dynamic recommended A record IPv4
    let recommendedIPv4 = defaultA;
    if (Array.isArray(data.recommendedIPv4) && data.recommendedIPv4.length > 0) {
      const topRank = data.recommendedIPv4[0];
      if (Array.isArray(topRank.value) && topRank.value[0]) {
        recommendedIPv4 = topRank.value[0];
      }
    }

    // Extract dynamic recommended CNAME (strip any trailing dot e.g. "cname.vercel-dns.com.")
    let recommendedCNAME = defaultCname;
    if (Array.isArray(data.recommendedCNAME) && data.recommendedCNAME.length > 0) {
      const topCname = data.recommendedCNAME[0];
      if (topCname.value && typeof topCname.value === "string") {
        recommendedCNAME = topCname.value.replace(/\.+$/, "");
      }
    }

    return {
      recommendedIPv4,
      recommendedCNAME,
      misconfigured: Boolean(data.misconfigured),
      rawConfig: data,
    };
  } catch (err) {
    console.error(`[VERCEL_CONFIG_FETCH_ERROR] domain=${domain}:`, err);
    return {
      recommendedIPv4: defaultA,
      recommendedCNAME: defaultCname,
      misconfigured: true,
    };
  }
}

/**
 * Checks verification status in Vercel project.
 */
export async function getVercelProjectDomainStatus(domain: string): Promise<{
  verified: boolean;
  verificationDetails?: any[];
  error?: string;
}> {
  const headers = getVercelHeaders();
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!headers || !projectId) {
    return { verified: false, error: "Vercel credentials not configured." };
  }

  try {
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}${getVercelTeamParam()}`,
      { headers }
    );

    if (!res.ok) {
      return { verified: false };
    }

    const data = await res.json();
    return {
      verified: Boolean(data.verified),
      verificationDetails: data.verification,
    };
  } catch (err: any) {
    return { verified: false, error: err?.message };
  }
}

/**
 * Triggers Vercel verification check for a domain.
 */
export async function triggerVercelDomainVerification(domain: string): Promise<boolean> {
  const headers = getVercelHeaders();
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!headers || !projectId) return false;

  try {
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}/verify${getVercelTeamParam()}`,
      {
        method: "POST",
        headers,
      }
    );

    if (res.ok) {
      const data = await res.json();
      return Boolean(data.verified);
    }
    return false;
  } catch {
    return false;
  }
}

// ============================================================================
// DNS & HTTPS RESOLUTION HELPERS
// ============================================================================

/**
 * Checks Node DNS A record resolution for apex domain.
 */
export async function checkApexDns(
  domain: string,
  expectedIp: string = "76.76.21.21"
): Promise<{ resolved: boolean; ips: string[] }> {
  try {
    const ips = await dns.resolve4(domain);
    const resolved = Array.isArray(ips) && (ips.includes(expectedIp) || ips.some((ip) => ip.startsWith("76.76.")));
    return { resolved, ips: ips || [] };
  } catch {
    return { resolved: false, ips: [] };
  }
}

/**
 * Checks Node DNS CNAME or A resolution for www subdomain.
 */
export async function checkWwwDns(
  domain: string,
  expectedCname: string = "cname.vercel-dns.com"
): Promise<{ resolved: boolean; targets: string[] }> {
  const wwwHost = `www.${domain}`;
  try {
    const cnames = await dns.resolveCname(wwwHost);
    const cleanExpected = expectedCname.toLowerCase().replace(/\.+$/, "");
    const resolved =
      Array.isArray(cnames) &&
      cnames.some((c) => {
        const clean = c.toLowerCase().replace(/\.+$/, "");
        return clean === cleanExpected || clean.includes("vercel") || clean.includes("codeaxys");
      });
    return { resolved, targets: cnames || [] };
  } catch {
    // If CNAME check failed, fallback to checking if www resolves to Vercel A record
    try {
      const ips = await dns.resolve4(wwwHost);
      const resolved = Array.isArray(ips) && ips.some((ip) => ip.startsWith("76.76."));
      return { resolved, targets: ips || [] };
    } catch {
      return { resolved: false, targets: [] };
    }
  }
}

/**
 * Checks if the custom domain is serving HTTPS securely without SSL error.
 */
export async function checkHttpsReadiness(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`https://${domain}/`, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "manual",
    });

    clearTimeout(timeout);
    // Any HTTP status indicates valid SSL handshake was completed!
    return res.status >= 200 && res.status < 600;
  } catch (err: any) {
    // SSL or connection failure
    return false;
  }
}

// ============================================================================
// MAIN VERIFICATION ORCHESTRATOR
// ============================================================================

/**
 * Full domain verification workflow executing real DNS, Vercel project sync, and SSL readiness checks.
 */
export async function verifyDomain(
  domainName: string,
  verificationToken?: string,
  options?: { wwwConfigured?: boolean }
): Promise<DomainVerificationResult> {
  const norm = normalizeCustomDomainInput(domainName);

  if (!norm.isValid) {
    return {
      verified: false,
      status: "none",
      message: norm.error || "Invalid domain format provided.",
      dnsRecordsRequired: {
        aRecord: { host: "@", value: "76.76.21.21", type: "A" },
        cname: { host: "www", value: "cname.vercel-dns.com", type: "CNAME" },
      },
    };
  }

  const cleanDomain = norm.canonicalDomain;
  const wwwConfigured = options?.wwwConfigured !== false;

  // 1. Fetch dynamic DNS requirements from Vercel
  const vercelConfig = await getVercelDomainConfig(cleanDomain);

  const dnsRecordsRequired = {
    aRecord: {
      host: "@",
      value: vercelConfig.recommendedIPv4 || "76.76.21.21",
      type: "A" as const,
    },
    cname: {
      host: "www",
      value: vercelConfig.recommendedCNAME || "cname.vercel-dns.com",
      type: "CNAME" as const,
    },
    txtRecord: verificationToken
      ? {
          host: "_codexys-challenge",
          value: verificationToken,
          type: "TXT" as const,
        }
      : undefined,
  };

  // 2. Perform live DNS resolution checks
  const apexCheck = await checkApexDns(cleanDomain, dnsRecordsRequired.aRecord.value);
  let wwwCheck = { resolved: true, targets: [] as string[] };
  if (wwwConfigured) {
    wwwCheck = await checkWwwDns(cleanDomain, dnsRecordsRequired.cname.value);
  }

  // 3. Vercel project status & verification trigger
  let vercelStatus = await getVercelProjectDomainStatus(cleanDomain);

  // If DNS has resolved to Vercel but Vercel domain isn't marked verified yet, trigger verification
  if (apexCheck.resolved && !vercelStatus.verified) {
    const verifiedNow = await triggerVercelDomainVerification(cleanDomain);
    if (verifiedNow) {
      vercelStatus.verified = true;
    }
  }

  // If www configured, also verify www domain in Vercel if needed
  if (wwwConfigured && wwwCheck.resolved) {
    await triggerVercelDomainVerification(`www.${cleanDomain}`);
  }

  // 4. Test HTTPS SSL readiness
  let sslReady = false;
  if (apexCheck.resolved && vercelStatus.verified) {
    sslReady = await checkHttpsReadiness(cleanDomain);
  }

  // 5. Compute actionable status and user-friendly message
  let status: DomainStatus = "pending_dns";
  let message = "";

  if (!apexCheck.resolved) {
    if (apexCheck.ips.length > 0) {
      status = "error";
      message = `DNS record for @ is currently pointing to ${apexCheck.ips.join(", ")}, not ${dnsRecordsRequired.aRecord.value}. Please update your A record and allow time for DNS propagation.`;
    } else {
      status = "pending_dns";
      message = "Domain added, but DNS changes have not propagated yet. Please add the required DNS records at your domain registrar.";
    }
  } else if (wwwConfigured && !wwwCheck.resolved) {
    status = "error";
    message = `www.${cleanDomain} is not pointing to ${dnsRecordsRequired.cname.value}. Please add the CNAME record for host 'www' to enable www redirection.`;
  } else if (!vercelStatus.verified) {
    status = "dns_configured";
    message = "DNS records detected. Domain configuration is propagating across Vercel global infrastructure.";
  } else if (!sslReady) {
    status = "ssl_pending";
    message = "Domain verified. SSL certificate is being provisioned. Your website will be live in 1-2 minutes.";
  } else {
    status = "ready";
    message = "Custom domain is verified and ready. SSL active.";
  }

  const isFullyReady = status === "ready" || (apexCheck.resolved && vercelStatus.verified);

  return {
    verified: isFullyReady,
    status,
    message,
    dnsRecordsRequired,
    dnsChecks: {
      apexIpMatch: apexCheck.resolved,
      apexIps: apexCheck.ips,
      expectedIp: dnsRecordsRequired.aRecord.value,
      wwwMatch: wwwConfigured ? wwwCheck.resolved : undefined,
      wwwTarget: wwwConfigured ? wwwCheck.targets : undefined,
      expectedCname: wwwConfigured ? dnsRecordsRequired.cname.value : undefined,
    },
    sslReady,
    vercelVerified: vercelStatus.verified,
  };
}
