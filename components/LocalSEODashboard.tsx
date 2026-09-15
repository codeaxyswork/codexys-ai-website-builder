"use client";

import React, { useState, useEffect } from "react";
import { LocalBusinessProfile, LocalSEOAnalysisResult } from "@/lib/local-seo-engine";

interface LocalSEODashboardProps {
  websiteId: string;
}

export function LocalSEODashboard({ websiteId }: LocalSEODashboardProps) {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [profile, setProfile] = useState<LocalBusinessProfile>({
    business_name: "",
    business_type: "LocalBusiness",
    primary_category: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state_region: "",
    postal_code: "",
    country: "",
    phone: "",
    website_url: "",
    business_description: "",
    service_area: "",
    price_range: "",
    gbp_profile_url: "",
  });

  const [analysis, setAnalysis] = useState<LocalSEOAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedSchema, setCopiedSchema] = useState(false);

  useEffect(() => {
    fetchLocalSEOData();
  }, [websiteId]);

  const fetchLocalSEOData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch(`/api/websites/${websiteId}/seo/local`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to load Local SEO data.");
      }
      const resData = await res.json();
      if (resData.profile) {
        setProfile((prev) => ({ ...prev, ...resData.profile }));
      }
      if (resData.analysis_result) {
        setAnalysis(resData.analysis_result);
      }
    } catch (err: any) {
      console.error("Fetch local SEO error:", err);
      setErrorMessage(err.message || "Failed to load Local SEO data.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await fetch(`/api/websites/${websiteId}/seo/local`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to save profile.");
      }

      const resData = await res.json();
      if (resData.analysis_result) {
        setAnalysis(resData.analysis_result);
      }
      setSuccessMessage("Local Business Profile saved and analyzed successfully!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Save profile error:", err);
      setErrorMessage(err.message || "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReAnalyze = async () => {
    try {
      setIsAnalyzing(true);
      setErrorMessage(null);

      const res = await fetch(`/api/websites/${websiteId}/seo/local/analyze`, {
        method: "POST",
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Re-analysis failed.");
      }

      const resData = await res.json();
      setAnalysis(resData);
    } catch (err: any) {
      console.error("Re-analyze local error:", err);
      setErrorMessage(err.message || "Re-analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopySchema = () => {
    if (!analysis?.schema_markup) return;
    const jsonStr = JSON.stringify(analysis.schema_markup, null, 2);
    navigator.clipboard.writeText(`<script type="application/ld+json">\n${jsonStr}\n</script>`);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 3000);
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
        <div className="inline-flex items-center gap-3 text-slate-600 font-medium text-sm">
          <svg className="animate-spin h-5 w-5 text-purple-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading Local SEO Engine & Business Profile...
        </div>
      </div>
    );
  }

  const score = analysis?.local_seo_score ?? 0;
  const nap = analysis?.nap_health;
  const schemaMarkup = analysis?.schema_markup;

  const getScoreBadge = (s: number) => {
    if (s >= 80) return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">Optimal ({s}/100)</span>;
    if (s >= 60) return <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">Needs Work ({s}/100)</span>;
    return <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-full">Critical ({s}/100)</span>;
  };

  return (
    <div className="space-y-8 text-slate-900">
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex justify-between items-center">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold text-rose-600">×</button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex justify-between items-center">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="font-bold text-emerald-600">×</button>
        </div>
      )}

      {/* 1. Header & Scorecard */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">Local SEO Health</h2>
            {getScoreBadge(score)}
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Deterministic audit of NAP (Name, Address, Phone) consistency, location relevance signals, structured LocalBusiness JSON-LD schema, and Google Business Profile readiness.
          </p>
          <div className="text-[11px] text-slate-400">
            Last analyzed: {analysis?.last_analyzed_at ? new Date(analysis.last_analyzed_at).toLocaleString() : "Just now"} • Deterministic Engine (0 AI Credits)
          </div>
        </div>

        <button
          type="button"
          onClick={handleReAnalyze}
          disabled={isAnalyzing}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs shrink-0 disabled:opacity-50"
        >
          {isAnalyzing ? "Analyzing Signals..." : "Re-Analyze Local Signals"}
        </button>
      </div>

      {/* 2. NAP Health Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Business Name (NAP)</span>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">{profile.business_name || "Not Set"}</span>
            {nap?.name_status === "consistent" ? (
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">Consistent</span>
            ) : (
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">Missing on Site</span>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone Number (NAP)</span>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">{profile.phone || "Not Set"}</span>
            {nap?.phone_status === "consistent" ? (
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">Consistent</span>
            ) : (
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">Missing on Site</span>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">City / Address (NAP)</span>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">{profile.city || "Not Set"}</span>
            {nap?.address_status === "consistent" ? (
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">Consistent</span>
            ) : (
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">Missing on Site</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Business Profile Editor Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          Local Business Profile Configuration
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name *</label>
              <input
                type="text"
                value={profile.business_name || ""}
                onChange={(e) => setProfile({ ...profile, business_name: e.target.value })}
                placeholder="e.g. Codeaxys Digital Agency"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Business Type</label>
              <select
                value={profile.business_type || "LocalBusiness"}
                onChange={(e) => setProfile({ ...profile, business_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                <option value="LocalBusiness">LocalBusiness (General)</option>
                <option value="ProfessionalService">ProfessionalService (Agency, Consultant)</option>
                <option value="Restaurant">Restaurant / Food Service</option>
                <option value="MedicalBusiness">MedicalBusiness (Clinic, Doctor)</option>
                <option value="Store">Store / Retail Shop</option>
                <option value="Hotel">Hotel / Lodging</option>
                <option value="Organization">Organization</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Category</label>
              <input
                type="text"
                value={profile.primary_category || ""}
                onChange={(e) => setProfile({ ...profile, primary_category: e.target.value })}
                placeholder="e.g. Web Design Agency"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={profile.phone || ""}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="e.g. +1 (512) 555-0199"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address Line 1</label>
              <input
                type="text"
                value={profile.address_line1 || ""}
                onChange={(e) => setProfile({ ...profile, address_line1: e.target.value })}
                placeholder="e.g. 100 Main Street"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City / Locality</label>
              <input
                type="text"
                value={profile.city || ""}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                placeholder="e.g. Austin"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State / Region</label>
              <input
                type="text"
                value={profile.state_region || ""}
                onChange={(e) => setProfile({ ...profile, state_region: e.target.value })}
                placeholder="e.g. TX"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Postal Code</label>
              <input
                type="text"
                value={profile.postal_code || ""}
                onChange={(e) => setProfile({ ...profile, postal_code: e.target.value })}
                placeholder="e.g. 78701"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
              <input
                type="text"
                value={profile.country || ""}
                onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                placeholder="e.g. US"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Price Range</label>
              <input
                type="text"
                value={profile.price_range || ""}
                onChange={(e) => setProfile({ ...profile, price_range: e.target.value })}
                placeholder="e.g. $$"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Service Area / Regions</label>
              <input
                type="text"
                value={profile.service_area || ""}
                onChange={(e) => setProfile({ ...profile, service_area: e.target.value })}
                placeholder="e.g. Greater Austin Area, Texas"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Google Business Profile URL</label>
              <input
                type="url"
                value={profile.gbp_profile_url || ""}
                onChange={(e) => setProfile({ ...profile, gbp_profile_url: e.target.value })}
                placeholder="https://maps.google.com/..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Local Profile & Re-Analyze"}
            </button>
          </div>
        </form>
      </div>

      {/* 4. LocalBusiness JSON-LD Schema Preview */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Generated LocalBusiness JSON-LD Schema</h3>
            <p className="text-xs text-slate-500 mt-0.5">Structured data for Google Local Map Pack & Rich Snippets.</p>
          </div>
          {schemaMarkup && (
            <button
              type="button"
              onClick={handleCopySchema}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all"
            >
              {copiedSchema ? "✓ Copied!" : "Copy JSON-LD Tag"}
            </button>
          )}
        </div>

        {schemaMarkup ? (
          <pre className="p-4 bg-slate-900 text-purple-300 font-mono text-[11px] rounded-xl overflow-x-auto max-h-60 leading-relaxed">
            {JSON.stringify(schemaMarkup, null, 2)}
          </pre>
        ) : (
          <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
            Configure your Business Name above to generate LocalBusiness JSON-LD schema.
          </div>
        )}
      </div>

      {/* 5. Priority Issues & Audit Findings */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          Priority Local SEO Findings ({analysis?.issues.length || 0})
        </h3>

        {(!analysis?.issues || analysis.issues.length === 0) ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No local SEO issues detected.
          </div>
        ) : (
          <div className="space-y-3">
            {analysis.issues.map((iss) => (
              <div key={iss.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                {iss.severity === "critical" && <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold text-[10px] rounded uppercase shrink-0">Critical</span>}
                {iss.severity === "warning" && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded uppercase shrink-0">Warning</span>}
                {iss.severity === "opportunity" && <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold text-[10px] rounded uppercase shrink-0">Opportunity</span>}
                {iss.severity === "passed" && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded uppercase shrink-0">Passed</span>}

                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-900 block">{iss.title}</span>
                  <p className="text-xs text-slate-600 leading-relaxed">{iss.details}</p>
                  <p className="text-[11px] text-purple-700 font-medium">💡 Recommendation: {iss.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
