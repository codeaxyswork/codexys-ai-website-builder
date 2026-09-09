export interface DomainVerificationResult {
  verified: boolean;
  status: "none" | "pending_dns" | "verifying" | "verified" | "failed";
  message: string;
  dnsRecordsRequired: {
    cname: { host: string; value: string };
    aRecord: { host: string; value: string };
    txtRecord?: { host: string; value: string };
  };
}

export async function verifyDomain(
  domainName: string,
  verificationToken?: string
): Promise<DomainVerificationResult> {
  const cleanDomain = domainName.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
  const cnameTarget = process.env.NEXT_PUBLIC_APP_DOMAIN || process.env.APP_DOMAIN || "cname.codexys.site";
  const aRecordIp = process.env.HOSTING_A_RECORD_IP || "76.76.21.21"; // Standard configurable hosting IP

  const dnsRecordsRequired = {
    cname: { host: "www", value: cnameTarget },
    aRecord: { host: "@", value: aRecordIp },
    txtRecord: verificationToken ? { host: "_codexys-challenge", value: verificationToken } : undefined,
  };

  if (!cleanDomain) {
    return {
      verified: false,
      status: "none",
      message: "No custom domain provided.",
      dnsRecordsRequired,
    };
  }

  // Future Vercel Provider API integration check:
  const vercelToken = process.env.VERCEL_TOKEN;
  const vercelProjectId = process.env.VERCEL_PROJECT_ID;

  if (vercelToken && vercelProjectId) {
    try {
      const res = await fetch(
        `https://api.vercel.com/v9/projects/${vercelProjectId}/domains/${cleanDomain}?teamId=${process.env.VERCEL_TEAM_ID || ""}`,
        {
          headers: { Authorization: `Bearer ${vercelToken}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const isVerified = Boolean(data.verified);
        return {
          verified: isVerified,
          status: isVerified ? "verified" : "verifying",
          message: isVerified ? "Domain verified on Vercel infrastructure." : "Domain DNS propagation pending on Vercel.",
          dnsRecordsRequired,
        };
      }
    } catch (err) {
      console.error("Vercel Domain API Verification Check Error:", err);
    }
  }

  // Architecture ready placeholder response for unconfigured DNS environment:
  return {
    verified: false,
    status: "pending_dns",
    message: "Custom domain registered. Please configure CNAME or A record with your DNS provider to complete verification.",
    dnsRecordsRequired,
  };
}
