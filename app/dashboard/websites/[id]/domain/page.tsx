"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
        if (found) setWebsite(found);
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
      setStatusMessage("Custom domain configuration saved. Configure DNS records below.");
    } catch (err: any) {
      console.error("Save Domain Error:", err);
      setErrorMessage(err.message || "Failed to update domain.");
    } finally {
      setIsSaving(false);
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
      setStatusMessage("Custom domain configuration removed.");
    } catch (err: any) {
      console.error("Delete Domain Error:", err);
      setErrorMessage(err.message || "Failed to remove domain.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getStatusBadge = (status: string, isVerified: boolean) => {
    if (isVerified || status === "verified") {
      return (
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Connected & Verified
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
    if (status === "verifying") {
      return (
        <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-spin"></span>
          Verifying Propagation...
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-all"
            >
              ← Back to Dashboard
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{website?.title || "Custom Domain"}</h1>
              <p className="text-xs text-slate-500">Domain & DNS Host Configuration</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/websites/${websiteId}/seo`}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all"
            >
              SEO Settings ↗
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="font-bold hover:text-rose-900">
              ×
            </button>
          </div>
        )}

        {statusMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center justify-between">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)} className="font-bold hover:text-emerald-900">
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
              domainData?.custom_domain_verified
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
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm rounded-lg shadow-sm transition-all disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : domainData?.custom_domain ? "Update Domain" : "Add Custom Domain"}
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
                Also direct www requests (e.g. www.mycompany.com) to this website
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
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              DNS Records Required
            </h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Log into your domain provider (e.g. GoDaddy, Namecheap, Cloudflare) and add the following DNS records:
            </p>

            <div className="space-y-4">
              {/* CNAME Record */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-700 block">1. CNAME Record</span>
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
                  {copiedKey === "cname" ? "✓ Copied" : "Copy Value"}
                </button>
              </div>

              {/* A Record */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-700 block">2. A Record</span>
                  <div className="flex items-center gap-3 text-xs text-slate-700 mt-1">
                    <span>Host: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">{dnsInstructions.aRecord.host}</strong></span>
                    <span>IP Value: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">{dnsInstructions.aRecord.value}</strong></span>
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

              {/* TXT Challenge Record */}
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
          </div>
        )}
      </main>
    </div>
  );
}
