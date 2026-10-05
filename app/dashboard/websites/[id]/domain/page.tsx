"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Globe,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  ShieldCheck,
  Send,
  Loader2,
  Lock,
} from "lucide-react";
import { getWebsitePublicUrl } from "@/lib/domain-resolver";

interface DomainPageProps {
  params: Promise<{ id: string }>;
}

export default function DomainManagementPage({ params }: DomainPageProps) {
  const { id: websiteId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [website, setWebsite] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [canCustomDomain, setCanCustomDomain] = useState<boolean>(false);

  const [domainInput, setDomainInput] = useState("");
  const [wwwConfigured, setWwwConfigured] = useState(true);
  const [domainData, setDomainData] = useState<any>(null);
  const [dnsInstructions, setDnsInstructions] = useState<any>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccessUrl, setPublishSuccessUrl] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, [websiteId]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Website Details
      const siteRes = await fetch("/api/websites");
      if (siteRes.ok) {
        const siteData = await siteRes.json();
        const found = (siteData.websites || []).find((w: any) => w.id === websiteId);
        if (found) {
          setWebsite(found);
          if (found.is_published) {
            const canonical = getWebsitePublicUrl(found);
            setPublishSuccessUrl(canonical);
          }
        }
      }

      // 2. Fetch User Plan Usage
      const usageRes = await fetch("/api/user/usage");
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        if (usageData?.plan) {
          setUserPlan(usageData.plan.id);
          setCanCustomDomain(Boolean(usageData.plan.allow_custom_domain));
        }
      }

      // 3. Fetch Domain Info
      const domainRes = await fetch(`/api/websites/${websiteId}/domain`);
      if (domainRes.ok) {
        const dData = await domainRes.json();
        setDomainData(dData.domain || null);
        setDnsInstructions(dData.dnsInstructions || null);
        if (dData.domain?.custom_domain) {
          setDomainInput(dData.domain.custom_domain);
          setWwwConfigured(dData.domain.www_domain_configured !== false);
        }
        if (dData.verificationMessage) {
          setStatusMessage(dData.verificationMessage);
        }
      }
    } catch (err: any) {
      console.error("Failed to load Domain Management page:", err);
    } finally {
      setLoading(false);
    }
  };

  const cleanDomainInput = (val: string): string => {
    if (!val) return "";
    let clean = val.trim().toLowerCase();
    clean = clean.replace(/^(https?:\/\/|\/\/)/i, "");
    clean = clean.replace(/[\/\?#].*$/, "");
    clean = clean.replace(/:\d+$/, "");
    clean = clean.replace(/\.+$/, "");
    return clean;
  };

  const handleDomainInputChange = (val: string) => {
    // Automatically clean if input contains URL artifacts like protocol or slashes
    if (val.includes("://") || val.includes("/") || val.includes(" ") || val.includes(":")) {
      const cleaned = cleanDomainInput(val);
      setDomainInput(cleaned);
    } else {
      setDomainInput(val);
    }
  };

  const handleSaveDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = cleanDomainInput(domainInput);
    if (!sanitized) return;

    try {
      setIsSaving(true);
      setErrorMessage(null);
      setStatusMessage(null);

      const res = await fetch(`/api/websites/${websiteId}/domain`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          custom_domain: sanitized,
          www_domain_configured: wwwConfigured,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === "UPGRADE_REQUIRED") {
          throw new Error("Custom domain connection requires a Pro or Agency plan upgrade.");
        }
        throw new Error(data.error || "Failed to update domain settings.");
      }

      setDomainInput(data.domain.custom_domain || sanitized);
      setDomainData(data.domain);
      setDnsInstructions(data.dnsInstructions);

      if (data.status === "ready" || data.domain.custom_domain_verified) {
        setStatusMessage("✓ Custom domain attached, verified, and SSL ready!");
      } else {
        setStatusMessage("✓ Domain attached! Add the required DNS records below and click 'Verify DNS'.");
      }
    } catch (err: any) {
      console.error("Save Domain Error:", err);
      setErrorMessage(err.message || "Failed to update domain.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyDns = async () => {
    if (!domainData?.custom_domain || isVerifying) return;
    try {
      setIsVerifying(true);
      setErrorMessage(null);
      setStatusMessage(null);

      const res = await fetch(`/api/websites/${websiteId}/domain/verify`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "DNS verification check failed.");
      }

      setDomainData(data.domain || {
        ...domainData,
        custom_domain_status: data.status,
        custom_domain_verified: data.verified,
      });

      if (data.dnsInstructions) {
        setDnsInstructions(data.dnsInstructions);
      }

      if (data.verified || data.status === "ready") {
        setStatusMessage("✓ Custom domain verified and ready! SSL active and live.");
        if (website?.is_published) {
          const canonical = `https://${domainData.custom_domain}`;
          setPublishSuccessUrl(canonical);
        }
      } else if (data.status === "ssl_pending") {
        setStatusMessage("✓ DNS records verified! SSL certificate is being provisioned. Ready in 1-2 minutes.");
      } else if (data.status === "dns_configured") {
        setStatusMessage("✓ DNS detected! Propagating across global infrastructure.");
      } else if (data.message) {
        setStatusMessage(data.message);
      }
    } catch (err: any) {
      console.error("Verify DNS Error:", err);
      setErrorMessage(err.message || "Failed to verify DNS records.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDeleteDomain = async () => {
    if (!confirm("Are you sure you want to remove this custom domain configuration?")) return;

    try {
      setIsDeleting(true);
      setErrorMessage(null);

      const res = await fetch(`/api/websites/${websiteId}/domain`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove domain.");
      }

      setDomainInput("");
      setDomainData(null);
      setDnsInstructions(null);
      setStatusMessage("Custom domain configuration removed. Fallback Codeaxys subdomain restored.");
    } catch (err: any) {
      console.error("Delete Domain Error:", err);
      setErrorMessage(err.message || "Failed to remove domain.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePublishWebsite = async () => {
    if (!websiteId || isPublishing) return;
    try {
      setIsPublishing(true);
      setErrorMessage(null);

      const res = await fetch(`/api/websites/${websiteId}/publish`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to publish website.");
      }

      const finalUrl = data.publicUrl || data.url;
      setPublishSuccessUrl(finalUrl);
      setWebsite((prev: any) => ({
        ...prev,
        is_published: true,
        published_slug: data.slug,
      }));

      setStatusMessage("✓ Website published successfully!");

      // Automatically open the final live URL in a new browser tab
      if (finalUrl) {
        window.open(finalUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      console.error("Publish Error:", err);
      setErrorMessage(err.message || "Failed to publish website.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getStatusBadge = (status: string, isVerified: boolean) => {
    if (isVerified || status === "ready" || status === "verified") {
      return (
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Connected & Live (SSL Ready)
        </span>
      );
    }
    if (status === "ssl_pending") {
      return (
        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          DNS Verified · SSL Provisioning...
        </span>
      );
    }
    if (status === "dns_configured") {
      return (
        <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          DNS Detected · Propagating...
        </span>
      );
    }
    if (status === "verifying") {
      return (
        <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500 animate-spin"></span>
          Verifying Propagation...
        </span>
      );
    }
    if (status === "error") {
      return (
        <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          DNS Misconfigured
        </span>
      );
    }
    if (status === "pending_dns") {
      return (
        <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Pending DNS Setup
        </span>
      );
    }
    return (
      <span className="px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
        Not Connected
      </span>
    );
  };

  const isCustomDomainReady = Boolean(
    domainData?.custom_domain &&
      (domainData?.custom_domain_verified ||
        domainData?.custom_domain_status === "ready" ||
        domainData?.custom_domain_status === "verified")
  );

  const canonicalDisplayUrl = isCustomDomainReady
    ? `https://${domainData.custom_domain}`
    : website
    ? getWebsitePublicUrl(website)
    : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-600 font-medium">
          <svg className="animate-spin h-5 w-5 text-purple-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading Domain Management...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      {/* SaaS Navigation Header */}
      <header className="h-16 border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
          <Link
            href={`/dashboard/websites/${websiteId}`}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200/90 bg-slate-50 hover:bg-slate-100 text-xs sm:text-sm font-bold text-slate-700 transition-all shadow-2xs shrink-0"
            title="Return to Website Dashboard Hub"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Website Hub</span>
          </Link>

          <div className="h-4 w-px bg-slate-200 shrink-0" />

          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-purple-600" />
            </div>
            <h1 className="font-bold text-slate-900 text-sm sm:text-base truncate max-w-[180px] sm:max-w-md">
              {website?.title || "Custom Domain"} — Domain Management
            </h1>
          </div>
        </div>

        {/* Quick Navigation Tabs & Primary Module Links */}
        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 mr-2">
            <Link
              href={`/dashboard/websites/${websiteId}`}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold text-xs transition-all"
            >
              Overview
            </Link>
            <Link
              href={`/dashboard/websites/${websiteId}/seo`}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold text-xs transition-all"
            >
              SEO Control Center
            </Link>
            <Link
              href={`/dashboard/websites/${websiteId}/blog`}
              className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold text-xs transition-all"
            >
              Blog Engine
            </Link>
            <span className="px-3.5 py-1.5 rounded-lg bg-white text-purple-700 font-extrabold text-xs shadow-2xs">
              Domain
            </span>
          </nav>

          <Link
            href={`/dashboard/websites/${websiteId}/seo`}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-purple-200/90 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-bold transition-all shadow-2xs shrink-0"
          >
            <span>SEO Optimizer</span>
            <span className="text-xs opacity-80">&rarr;</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full flex-1">
        {/* Upgrade Notice Banner if Plan restricts */}
        {!canCustomDomain && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">⭐</span>
              <div>
                <h4 className="text-sm font-bold text-amber-900">Pro or Agency Plan Required</h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  Connecting custom domains (e.g. yourbrand.com) requires upgrading to a Pro or Agency subscription plan.
                </p>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="font-bold hover:text-rose-900 px-2 py-1">
              ×
            </button>
          </div>
        )}

        {statusMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="font-bold hover:text-emerald-900 px-2 py-1">
              ×
            </button>
          </div>
        )}

        {/* 1. DOMAIN CONFIGURATION CARD */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Custom Domain Setup
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Connect your own domain name (e.g., <code className="bg-slate-100 px-1 py-0.5 rounded">mycompany.com</code>) to your published website.
              </p>
            </div>

            {getStatusBadge(
              domainData?.custom_domain_status || "none",
              Boolean(domainData?.custom_domain_verified)
            )}
          </div>

          <form onSubmit={handleSaveDomain} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Domain Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => handleDomainInputChange(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    if (pasted) {
                      e.preventDefault();
                      handleDomainInputChange(pasted);
                    }
                  }}
                  placeholder="e.g. mycompany.com or www.mycompany.com"
                  disabled={!canCustomDomain || isSaving}
                  className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-50 font-mono"
                />
                <button
                  type="submit"
                  disabled={!canCustomDomain || isSaving || !domainInput.trim()}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 shrink-0"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isSaving ? "Saving..." : domainData?.custom_domain ? "Update Domain" : "Add Custom Domain"}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                <span>💡</span>
                <span>You can paste full URLs like <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700">https://mycompany.com/</code> — it will automatically clean to <code className="bg-slate-100 px-1 py-0.5 rounded font-semibold text-slate-800">mycompany.com</code>.</span>
              </p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={wwwConfigured}
                onChange={(e) => setWwwConfigured(e.target.checked)}
                className="h-4 w-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
              />
              <span className="text-xs font-semibold text-slate-700">
                Also direct www requests (e.g. www.mycompany.com) to this website via 308 permanent redirect
              </span>
            </label>
          </form>

          {domainData?.custom_domain && (
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Current Domain: <strong className="text-slate-900 font-mono">{domainData.custom_domain}</strong>
              </span>
              <button
                type="button"
                onClick={handleDeleteDomain}
                disabled={isDeleting}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
              >
                {isDeleting ? "Removing..." : "Remove Custom Domain"}
              </button>
            </div>
          )}
        </div>

        {/* 2. DNS INSTRUCTIONS CARD */}
        {dnsInstructions && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  DNS Records Required
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add the exact records below at your domain registrar (GoDaddy, Cloudflare, Namecheap).
                </p>
              </div>

              {/* Verify DNS Action Button */}
              <button
                type="button"
                onClick={handleVerifyDns}
                disabled={isVerifying}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 shrink-0"
              >
                {isVerifying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>{isVerifying ? "Verifying DNS..." : "Verify DNS"}</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* A Record */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-700 block">1. A Record (Apex)</span>
                  <div className="flex items-center gap-3 text-xs text-slate-700 mt-1">
                    <span>Host: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">{dnsInstructions.aRecord.host}</strong></span>
                    <span>IP Target: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">{dnsInstructions.aRecord.value}</strong></span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(dnsInstructions.aRecord.value, "aRecord")}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-all"
                >
                  {copiedKey === "aRecord" ? "✓ Copied" : "Copy IP"}
                </button>
              </div>

              {/* CNAME Record */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-700 block">2. CNAME Record (www Subdomain)</span>
                  <div className="flex items-center gap-3 text-xs text-slate-700 mt-1">
                    <span>Host: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">{dnsInstructions.cname.host}</strong></span>
                    <span>Target: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">{dnsInstructions.cname.value}</strong></span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(dnsInstructions.cname.value, "cname")}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-all"
                >
                  {copiedKey === "cname" ? "✓ Copied" : "Copy Target"}
                </button>
              </div>

              {/* TXT Challenge Record (Optional) */}
              {dnsInstructions.txtRecord && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700 block">3. TXT Verification Record</span>
                    <div className="flex items-center gap-3 text-xs text-slate-700 mt-1">
                      <span>Host: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">{dnsInstructions.txtRecord.host}</strong></span>
                      <span>Token: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[200px]">{dnsInstructions.txtRecord.value}</strong></span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(dnsInstructions.txtRecord.value, "txtRecord")}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-all"
                  >
                    {copiedKey === "txtRecord" ? "✓ Copied" : "Copy Token"}
                  </button>
                </div>
              )}
            </div>

            {/* Verification State Progression Indicator */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-3">Verification Pipeline</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-800">1. Domain Added</span>
                </div>

                <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                  domainData?.custom_domain_status === "dns_configured" ||
                  domainData?.custom_domain_status === "ssl_pending" ||
                  domainData?.custom_domain_status === "ready" ||
                  domainData?.custom_domain_verified
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-slate-50 border-slate-200 text-slate-500"
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-semibold">2. DNS Detected</span>
                </div>

                <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                  domainData?.custom_domain_status === "ssl_pending" ||
                  domainData?.custom_domain_status === "ready" ||
                  domainData?.custom_domain_verified
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-slate-50 border-slate-200 text-slate-500"
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-semibold">3. Domain Verified</span>
                </div>

                <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                  domainData?.custom_domain_status === "ready" || domainData?.custom_domain_verified
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-slate-50 border-slate-200 text-slate-500"
                }`}>
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-semibold">4. SSL Ready</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. PUBLISH & GO LIVE CARD */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-600" />
                Publish Website & Go Live
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Publish your website to make it publicly accessible on the web.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  website?.is_published ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              <span className="text-xs font-bold text-slate-800">
                Status: {website?.is_published ? "Published & Live" : "Unpublished Draft"}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-xs text-slate-500 block">Canonical Public URL:</span>
              <strong className="text-sm font-mono text-purple-700 break-all">
                {publishSuccessUrl || canonicalDisplayUrl || "https://..."}
              </strong>
              {isCustomDomainReady && (
                <span className="inline-block mt-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
                  ✓ Serving over verified custom domain
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {publishSuccessUrl && (
                <a
                  href={publishSuccessUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold shadow-xs transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                  <span>Open Website</span>
                </a>
              )}

              <button
                type="button"
                onClick={handlePublishWebsite}
                disabled={isPublishing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
              >
                {isPublishing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isPublishing ? "Publishing..." : website?.is_published ? "Re-publish Website" : "Publish Website"}</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
