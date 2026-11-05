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
  Search,
  ShoppingCart,
  Calendar,
  Settings,
  Server,
  Plus,
  Trash2,
  Tag,
  Check,
  ChevronRight,
  Info,
} from "lucide-react";
import { getWebsitePublicUrl } from "@/lib/domain-resolver";
import type { DomainCheckResult, SupportedTldInfo, DnsRecord } from "@/lib/resellerclub";
import type { CustomerDomainItem } from "@/app/api/domains/my-domains/route";

interface DomainPageProps {
  params: Promise<{ id: string }>;
}

type TabMode = "connect" | "buy" | "my_domains" | "renew_manage";

export default function DomainManagementPage({ params }: DomainPageProps) {
  const { id: websiteId } = use(params);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabMode>("connect");
  const [loading, setLoading] = useState(true);
  const [website, setWebsite] = useState<any>(null);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [canCustomDomain, setCanCustomDomain] = useState<boolean>(false);

  // Tab 1: Connect Existing Domain state
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

  // Tab 2: Buy New Domain state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DomainCheckResult[]>([]);
  const [selectedDomainToBuy, setSelectedDomainToBuy] = useState<DomainCheckResult | null>(null);
  const [purchaseYears, setPurchaseYears] = useState(1);
  const [protectPrivacy, setProtectPrivacy] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    company: "",
    email: "",
    addressLine1: "100 Tech Park",
    city: "Bangalore",
    state: "Karnataka",
    country: "IN",
    zipcode: "560001",
    phoneCountryCode: "91",
    phone: "9876543210",
  });

  // Tab 3: My Domains state
  const [myDomains, setMyDomains] = useState<CustomerDomainItem[]>([]);
  const [isLoadingMyDomains, setIsLoadingMyDomains] = useState(false);

  // Tab 4: Domain Renewal & Management state
  const [manageDomainName, setManageDomainName] = useState("");
  const [domainDnsRecords, setDomainDnsRecords] = useState<DnsRecord[]>([]);
  const [domainNameservers, setDomainNameservers] = useState<string[]>([]);
  const [isLoadingDns, setIsLoadingDns] = useState(false);
  const [newRecord, setNewRecord] = useState<{ type: "A" | "CNAME" | "TXT" | "MX"; host: string; value: string; ttl: number; priority?: number }>({
    type: "A",
    host: "@",
    value: "76.76.21.21",
    ttl: 3600,
  });
  const [isAddingRecord, setIsAddingRecord] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewYears, setRenewYears] = useState(1);

  useEffect(() => {
    fetchInitialData();
  }, [websiteId]);

  useEffect(() => {
    if (activeTab === "my_domains" || activeTab === "renew_manage") {
      fetchMyDomains();
    }
  }, [activeTab]);

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
          if (found.custom_domain) {
            setManageDomainName(found.custom_domain);
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
          setManageDomainName(dData.domain.custom_domain);
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

  const fetchMyDomains = async () => {
    try {
      setIsLoadingMyDomains(true);
      const res = await fetch("/api/domains/my-domains");
      if (res.ok) {
        const data = await res.json();
        setMyDomains(data.domains || []);
        if (!manageDomainName && data.domains?.length > 0) {
          setManageDomainName(data.domains[0].domain);
          loadDomainDns(data.domains[0].domain);
        }
      }
    } catch (err) {
      console.error("Failed to fetch my domains:", err);
    } finally {
      setIsLoadingMyDomains(false);
    }
  };

  const loadDomainDns = async (domainToLoad: string) => {
    if (!domainToLoad) return;
    try {
      setIsLoadingDns(true);
      const res = await fetch(`/api/domains/${encodeURIComponent(domainToLoad)}/dns`);
      if (res.ok) {
        const data = await res.json();
        setDomainDnsRecords(data.dnsRecords || []);
        setDomainNameservers(data.nameservers || []);
      }
    } catch (err) {
      console.error("Failed to load DNS:", err);
    } finally {
      setIsLoadingDns(false);
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
          throw new Error("Custom domain connection requires a Starter, Pro, Business, or Agency plan.");
        }
        throw new Error(data.error || "Failed to update domain settings.");
      }

      setDomainInput(data.domain.custom_domain || sanitized);
      setDomainData(data.domain);
      setDnsInstructions(data.dnsInstructions);
      setManageDomainName(data.domain.custom_domain || sanitized);

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
        throw new Error(data.error || "Publish failed.");
      }

      setWebsite((prev: any) => ({ ...prev, is_published: true }));
      const canonical = data.url || (domainData?.custom_domain ? `https://${domainData.custom_domain}` : null);
      setPublishSuccessUrl(canonical);
      setStatusMessage("✓ Website published and live to the world!");
    } catch (err: any) {
      console.error("Publish error:", err);
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

  // Tab 2: Domain Search & Buy Handlers
  const handleDomainSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return;

    try {
      setIsSearching(true);
      setErrorMessage(null);
      const res = await fetch(`/api/domains/search?query=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Domain search failed.");
      }
      setSearchResults(data.results || []);
    } catch (err: any) {
      console.error("Search error:", err);
      setErrorMessage(err.message || "Failed to search domain availability.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectDomainToBuy = (domainItem: DomainCheckResult) => {
    setSelectedDomainToBuy(domainItem);
    setPurchaseYears(1);
  };

  const handleExecutePurchase = async () => {
    if (!selectedDomainToBuy) return;

    try {
      setIsCheckingOut(true);
      setErrorMessage(null);

      // 1. Initialize Domain Checkout
      const checkoutRes = await fetch("/api/domains/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: selectedDomainToBuy.domain,
          years: purchaseYears,
          websiteId,
          protectPrivacy,
          contact: contactForm,
        }),
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) {
        throw new Error(checkoutData.error || "Failed to initialize domain purchase.");
      }

      // 2. Verification / Gateway Processing
      if (checkoutData.isFreeDomain || checkoutData.mode === "mock") {
        // Direct / Sandbox verification
        const verifyRes = await fetch("/api/domains/verify-purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: checkoutData.orderId,
            paymentId: `pay_dom_${Date.now()}`,
            signature: "verified_sandbox_token",
          }),
        });

        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData.success) {
          throw new Error(verifyData.error || "Failed to finalize domain registration.");
        }

        setStatusMessage(`🎉 Domain ${selectedDomainToBuy.domain} registered and connected!`);
        setSelectedDomainToBuy(null);
        fetchInitialData();
        setActiveTab("my_domains");
        return;
      }

      // 3. Razorpay Live Gateway Integration
      if (checkoutData.provider === "razorpay") {
        const loadScript = (): Promise<boolean> => {
          return new Promise((resolve) => {
            if (typeof window !== "undefined" && (window as any).Razorpay) return resolve(true);
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
          });
        };

        const loaded = await loadScript();
        if (!loaded || !(window as any).Razorpay) {
          throw new Error("Payment gateway could not be loaded. Please check your internet connection.");
        }

        const rzpOptions = {
          key: checkoutData.keyId,
          amount: Math.round(checkoutData.amount * 100),
          currency: checkoutData.currency || "INR",
          name: "Codeaxys Domains",
          description: `Domain Registration: ${selectedDomainToBuy.domain} (${purchaseYears} Yr)`,
          order_id: checkoutData.orderId,
          handler: async (resp: any) => {
            try {
              const verifyRes = await fetch("/api/domains/verify-purchase", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderId: resp.razorpay_order_id,
                  paymentId: resp.razorpay_payment_id,
                  signature: resp.razorpay_signature,
                }),
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok || !verifyData.success) {
                throw new Error(verifyData.error || "Payment verification failed.");
              }

              setStatusMessage(`🎉 Domain ${selectedDomainToBuy.domain} registered and connected!`);
              setSelectedDomainToBuy(null);
              fetchInitialData();
              setActiveTab("my_domains");
            } catch (vErr: any) {
              setErrorMessage(vErr.message || "Payment verification failed.");
            } finally {
              setIsCheckingOut(false);
            }
          },
          modal: {
            ondismiss: () => {
              setIsCheckingOut(false);
            },
          },
          theme: { color: "#7c3aed" },
        };

        const rzp = new (window as any).Razorpay(rzpOptions);
        rzp.open();
        return;
      }
    } catch (err: any) {
      console.error("Domain purchase error:", err);
      setErrorMessage(err.message || "Failed to purchase domain.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Tab 4: Renewal and DNS Handlers
  const handleAddDnsRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageDomainName || !newRecord.value.trim()) return;

    try {
      setIsAddingRecord(true);
      setErrorMessage(null);
      const res = await fetch(`/api/domains/${encodeURIComponent(manageDomainName)}/dns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_record",
          record: newRecord,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add DNS record.");

      setDomainDnsRecords(data.dnsRecords || []);
      setStatusMessage("✓ DNS record added successfully.");
      setNewRecord({ type: "A", host: "@", value: "", ttl: 3600 });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to add DNS record.");
    } finally {
      setIsAddingRecord(false);
    }
  };

  const handleDeleteDnsRecord = async (recordId: string) => {
    if (!manageDomainName || !confirm("Are you sure you want to delete this DNS record?")) return;

    try {
      const res = await fetch(
        `/api/domains/${encodeURIComponent(manageDomainName)}/dns?recordId=${encodeURIComponent(recordId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete record.");
      setDomainDnsRecords(data.dnsRecords || []);
      setStatusMessage("✓ DNS record removed.");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete DNS record.");
    }
  };

  const handleRenewDomain = async () => {
    if (!manageDomainName) return;
    try {
      setIsRenewing(true);
      setErrorMessage(null);
      const res = await fetch(`/api/domains/${encodeURIComponent(manageDomainName)}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ years: renewYears }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Renewal failed.");
      setStatusMessage(`✓ Domain ${manageDomainName} renewed for ${renewYears} year(s)!`);
      fetchMyDomains();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to renew domain.");
    } finally {
      setIsRenewing(false);
    }
  };

  const getStatusBadge = (status: string, verified: boolean) => {
    if (verified || status === "ready" || status === "active") {
      return (
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Connected & Verified
        </span>
      );
    }
    if (status === "ssl_pending") {
      return (
        <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
          Provisioning SSL...
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
          <Loader2 className="animate-spin h-5 w-5 text-purple-600" />
          Loading Domain Hub...
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
              {website?.title || "Domains"} — Domain Management
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
              Domains
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
      <main className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full flex-1">
        {/* Module Sub-Header with 4 Interactive Tabs */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2 shadow-xs flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("connect")}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === "connect"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Connect Existing Domain</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("buy")}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === "buy"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Buy New Domain</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-900 uppercase tracking-wider">
              ResellerClub
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("my_domains")}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === "my_domains"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Server className="w-4 h-4" />
            <span>My Domains</span>
            {myDomains.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                {myDomains.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("renew_manage");
              if (manageDomainName) loadDomainDns(manageDomainName);
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === "renew_manage"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Domain Renewal & Management</span>
          </button>
        </div>

        {/* Global Notifications */}
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

        {/* =========================================================================
            TAB 1: CONNECT EXISTING DOMAIN (PRESERVED)
        ========================================================================= */}
        {activeTab === "connect" && (
          <div className="space-y-6">
            {!canCustomDomain && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⭐</span>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">Active Paid Plan Required</h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Connecting customer-owned domains requires an active Starter, Pro, Business, or Agency subscription.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-purple-600" />
                    Connect Existing Customer-Owned Domain
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Point your existing domain from GoDaddy, Namecheap, Cloudflare, or Google Domains to your Codeaxys website.
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

            {dnsInstructions && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Server className="w-5 h-5 text-purple-600" />
                      Required DNS Records
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure these records at your current DNS provider.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyDns}
                    disabled={isVerifying}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 shrink-0"
                  >
                    {isVerifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>{isVerifying ? "Verifying..." : "Verify DNS"}</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-purple-700">1. A Record (Apex)</span>
                      <div className="text-xs text-slate-700 mt-1 flex gap-4">
                        <span>Host: <code>{dnsInstructions.aRecord.host}</code></span>
                        <span>Value: <code>{dnsInstructions.aRecord.value}</code></span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(dnsInstructions.aRecord.value, "aRecord")}
                      className="px-3 py-1 bg-white border border-slate-300 text-xs font-semibold rounded-lg"
                    >
                      {copiedKey === "aRecord" ? "Copied" : "Copy IP"}
                    </button>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-purple-700">2. CNAME Record (www Subdomain)</span>
                      <div className="text-xs text-slate-700 mt-1 flex gap-4">
                        <span>Host: <code>{dnsInstructions.cname.host}</code></span>
                        <span>Value: <code>{dnsInstructions.cname.value}</code></span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(dnsInstructions.cname.value, "cname")}
                      className="px-3 py-1 bg-white border border-slate-300 text-xs font-semibold rounded-lg"
                    >
                      {copiedKey === "cname" ? "Copied" : "Copy Target"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2: BUY NEW DOMAIN (RESELLERCLUB OFFICIAL INTEGRATION)
        ========================================================================= */}
        {activeTab === "buy" && (
          <div className="space-y-6">
            {/* Search Header Banner */}
            <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="relative z-10 max-w-3xl space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-bold">
                  <span>⚡ Official ResellerClub Direct Registration Engine</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  Find & Register Your Perfect Custom Domain
                </h2>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  Search live availability across hundreds of TLDs. Purchased domains are instantly verified, secured with SSL, and linked to your website.
                </p>

                {/* Live Search Input Form */}
                <form onSubmit={handleDomainSearch} className="pt-2 flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search domain name (e.g. acmebrand, velocity)..."
                      className="w-full pl-12 pr-4 py-3.5 bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-slate-900 border border-white/20 focus:border-purple-500 rounded-xl text-sm font-medium placeholder:text-slate-400 focus:outline-none transition-all shadow-inner"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-7 py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                  >
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span>{isSearching ? "Checking..." : "Search Availability"}</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Popular TLD Extensions Quick Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" /> Popular:
              </span>
              {[
                { tld: ".com", price: "₹899/yr" },
                { tld: ".in", price: "₹499/yr" },
                { tld: ".co.in", price: "₹449/yr" },
                { tld: ".net", price: "₹999/yr" },
                { tld: ".org", price: "₹999/yr" },
                { tld: ".io", price: "₹3,499/yr" },
                { tld: ".store", price: "₹299/yr" },
                { tld: ".tech", price: "₹399/yr" },
              ].map((pill) => (
                <button
                  key={pill.tld}
                  type="button"
                  onClick={() => {
                    const rawWord = searchQuery.replace(/\..*$/, "");
                    if (rawWord) {
                      setSearchQuery(`${rawWord}${pill.tld}`);
                      // Auto-trigger search
                      setTimeout(() => handleDomainSearch(), 50);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-xs font-semibold text-slate-700 hover:text-purple-700 transition-all shadow-2xs flex items-center gap-1.5"
                >
                  <span className="font-mono font-bold">{pill.tld}</span>
                  <span className="text-slate-400 font-normal">{pill.price}</span>
                </button>
              ))}
            </div>

            {/* Live Search Results Section */}
            {searchResults.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Available Domain Options ({searchResults.filter((r) => r.available).length} Found)
                  </h3>
                  <span className="text-xs text-slate-500">Real-Time Registry Query</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {searchResults.map((res) => (
                    <div
                      key={res.domain}
                      className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        res.available
                          ? "bg-slate-50/70 border-slate-200 hover:border-purple-300 hover:bg-purple-50/20"
                          : "bg-slate-100/60 border-slate-200 opacity-60"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-slate-900 text-sm">{res.domain}</span>
                          {res.available ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                              Available
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded-full">
                              Taken
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                          <span>Renews at ₹{res.price.renewal}/yr</span>
                          <span>•</span>
                          <span>Free SSL Included</span>
                        </div>
                      </div>

                      {res.available && (
                        <div className="text-right flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-sm font-black text-slate-900 font-mono">
                              ₹{res.price.registration}
                            </span>
                            <span className="text-[10px] text-slate-500 block">/ 1st year</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectDomainToBuy(res)}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>Select</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal / Slide-In Checkout Panel */}
            {selectedDomainToBuy && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold mb-2">
                        <span>ResellerClub Direct Registration</span>
                      </div>
                      <h3 className="text-xl font-black text-slate-900">
                        Register {selectedDomainToBuy.domain}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Will automatically be assigned to <strong>{website?.title}</strong> with full DNS & SSL setup.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDomainToBuy(null)}
                      className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Tenure Selection */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      Registration Period
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3].map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setPurchaseYears(yr)}
                          className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                            purchaseYears === yr
                              ? "bg-purple-50 border-purple-600 text-purple-700 shadow-xs"
                              : "border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <div>{yr} Year{yr > 1 ? "s" : ""}</div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            ₹{selectedDomainToBuy.price.registration + (yr - 1) * selectedDomainToBuy.price.renewal}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Privacy Protection */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">WHOIS Privacy Protection</span>
                      <span className="text-[11px] text-slate-500">Hides your personal identity and phone from public lookup.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={protectPrivacy}
                      onChange={(e) => setProtectPrivacy(e.target.checked)}
                      className="h-4 w-4 text-purple-600 rounded border-slate-300"
                    />
                  </div>

                  {/* Registrant Contact Info */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                      Registrant Contact Details
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-slate-500 block mb-1">Full Name</label>
                        <input
                          type="text"
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          placeholder="Full Name"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block mb-1">Email</label>
                        <input
                          type="email"
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          placeholder="email@company.com"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block mb-1">Phone Number</label>
                        <input
                          type="text"
                          value={contactForm.phone}
                          onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                          placeholder="10-digit mobile"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 block mb-1">City & State</label>
                        <input
                          type="text"
                          value={`${contactForm.city}, ${contactForm.state}`}
                          onChange={(e) => {
                            const parts = e.target.value.split(",");
                            setContactForm({
                              ...contactForm,
                              city: parts[0]?.trim() || contactForm.city,
                              state: parts[1]?.trim() || contactForm.state,
                            });
                          }}
                          placeholder="City, State"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Total & Action Button */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-500 block">Total Amount (Inc. GST)</span>
                      <strong className="text-xl font-black text-slate-900 font-mono">
                        ₹{selectedDomainToBuy.price.registration + (purchaseYears - 1) * selectedDomainToBuy.price.renewal}
                      </strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDomainToBuy(null)}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isCheckingOut}
                        onClick={handleExecutePurchase}
                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2"
                      >
                        {isCheckingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        <span>{isCheckingOut ? "Processing..." : "Complete Registration"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: MY DOMAINS (LIST OF ALL DOMAINS OWNED OR CONNECTED)
        ========================================================================= */}
        {activeTab === "my_domains" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Server className="w-5 h-5 text-purple-600" />
                  My Registered & Connected Domains
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Overview of all domains registered through Codeaxys or connected externally.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchMyDomains}
                disabled={isLoadingMyDomains}
                className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMyDomains ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {isLoadingMyDomains ? (
              <div className="p-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                <span>Loading your domains...</span>
              </div>
            ) : myDomains.length === 0 ? (
              <div className="p-8 text-center space-y-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Globe className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">No Domains Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  You haven't registered or connected any domains yet. You can buy a new custom domain or connect one you already own.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("buy")}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  Buy a Domain
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Domain Name</th>
                      <th className="py-3 px-4">Source</th>
                      <th className="py-3 px-4">Assigned Website</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Expiry Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myDomains.map((item) => (
                      <tr key={item.domain} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {item.domain}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.source === "registered"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {item.source === "registered" ? "ResellerClub" : "External DNS"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {item.websiteTitle || (item.websiteId ? "Linked Website" : "Unassigned")}
                        </td>
                        <td className="py-3.5 px-4">
                          {getStatusBadge(item.status, item.verified)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "External Registrar"}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setManageDomainName(item.domain);
                              loadDomainDns(item.domain);
                              setActiveTab("renew_manage");
                            }}
                            className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg border border-purple-200 text-[11px]"
                          >
                            Manage & DNS
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 4: DOMAIN RENEWAL AND MANAGEMENT (DNS, NAMESERVERS, EXPIRATION)
        ========================================================================= */}
        {activeTab === "renew_manage" && (
          <div className="space-y-6">
            {/* Domain Selector & Quick Status */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block">Managing Domain</span>
                <h3 className="text-xl font-mono font-black text-slate-900">
                  {manageDomainName || "No Domain Selected"}
                </h3>
              </div>

              {/* Renewal Section */}
              <div className="flex items-center gap-3">
                <select
                  value={renewYears}
                  onChange={(e) => setRenewYears(parseInt(e.target.value, 10))}
                  className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value={1}>1 Year Extension</option>
                  <option value={2}>2 Years Extension</option>
                  <option value={3}>3 Years Extension</option>
                </select>

                <button
                  type="button"
                  disabled={isRenewing || !manageDomainName}
                  onClick={handleRenewDomain}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"
                >
                  {isRenewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                  <span>{isRenewing ? "Renewing..." : "Renew Domain"}</span>
                </button>
              </div>
            </div>

            {/* Nameservers Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-600" />
                Active Nameservers
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {domainNameservers.length > 0 ? (
                  domainNameservers.map((ns, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800">
                      <strong>NS {idx + 1}:</strong> {ns}
                    </div>
                  ))
                ) : (
                  <>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800">
                      <strong>NS 1:</strong> ns1.codeaxys.com
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800">
                      <strong>NS 2:</strong> ns2.codeaxys.com
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* DNS Records Table & Add Record */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-purple-600" />
                    DNS Zone Management
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Add or modify A, CNAME, TXT, and MX records for your domain.
                  </p>
                </div>
              </div>

              {/* Add Record Form */}
              <form onSubmit={handleAddDnsRecord} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-end gap-3 text-xs">
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Type</label>
                  <select
                    value={newRecord.type}
                    onChange={(e: any) => setNewRecord({ ...newRecord, type: e.target.value })}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
                  >
                    <option value="A">A</option>
                    <option value="CNAME">CNAME</option>
                    <option value="TXT">TXT</option>
                    <option value="MX">MX</option>
                  </select>
                </div>

                <div className="flex-1 min-w-[120px]">
                  <label className="text-slate-600 font-bold block mb-1">Host / Name</label>
                  <input
                    type="text"
                    value={newRecord.host}
                    onChange={(e) => setNewRecord({ ...newRecord, host: e.target.value })}
                    placeholder="@ or subdomain"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>

                <div className="flex-2 min-w-[180px]">
                  <label className="text-slate-600 font-bold block mb-1">Value / Target</label>
                  <input
                    type="text"
                    value={newRecord.value}
                    onChange={(e) => setNewRecord({ ...newRecord, value: e.target.value })}
                    placeholder="IP or hostname"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-600 font-bold block mb-1">TTL (Seconds)</label>
                  <input
                    type="number"
                    value={newRecord.ttl}
                    onChange={(e) => setNewRecord({ ...newRecord, ttl: parseInt(e.target.value, 10) || 3600 })}
                    className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAddingRecord || !newRecord.value.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isAddingRecord ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Add Record</span>
                </button>
              </form>

              {/* Records List */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Host</th>
                      <th className="py-2.5 px-3">Value</th>
                      <th className="py-2.5 px-3">TTL</th>
                      <th className="py-2.5 px-3 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {domainDnsRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-bold text-purple-700">{rec.type}</td>
                        <td className="py-2.5 px-3 text-slate-800">{rec.host}</td>
                        <td className="py-2.5 px-3 text-slate-800 break-all">{rec.value}</td>
                        <td className="py-2.5 px-3 text-slate-500">{rec.ttl || 3600}s</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => rec.id && handleDeleteDnsRecord(rec.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. PUBLISH & GO LIVE CARD (ALWAYS VISIBLE AT BOTTOM) */}
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
