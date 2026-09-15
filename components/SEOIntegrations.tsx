"use client";

import React, { useState, useEffect } from "react";
import { SEOProviderConfig, SEOIntegrationRecord } from "@/lib/seo-integrations/types";

export interface IntegrationItem {
  id?: string;
  provider: string;
  status: string;
  configuration?: Record<string, any>;
  connected_at?: string | null;
  last_synced_at?: string | null;
}

interface SEOIntegrationsProps {
  integrations: IntegrationItem[];
  gaId: string;
  gtmId: string;
  gscVerificationToken?: string;
  onUpdateGaId: (val: string) => void;
  onUpdateGtmId: (val: string) => void;
  onUpdateGscVerificationToken?: (val: string) => void;
  onSaveIntegration: (provider: string, status: string, config: any) => Promise<void>;
  canUseIntegrations: boolean;
  websiteId?: string;
  onOpenPropertySelector?: () => void;
}

export function SEOIntegrations({
  integrations,
  gaId,
  gtmId,
  gscVerificationToken,
  onUpdateGaId,
  onUpdateGtmId,
  onUpdateGscVerificationToken,
  onSaveIntegration,
  websiteId,
}: SEOIntegrationsProps) {
  const gscItem = integrations.find((i) => i.provider === "google_search_console");
  const gscStatus = gscItem?.status || "disconnected";
  const gscConfig = gscItem?.configuration || {};
  const selectedProperty = gscConfig.selected_property || null;

  // Third-Party Framework State
  const [thirdPartyIntegrations, setThirdPartyIntegrations] = useState<SEOIntegrationRecord[]>([]);
  const [supportedProviders, setSupportedProviders] = useState<SEOProviderConfig[]>([]);
  const [loadingThirdParty, setLoadingThirdParty] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("ahrefs");
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Request Integration Form State
  const [requestForm, setRequestForm] = useState({ toolName: "", toolWebsite: "", apiDocsUrl: "", message: "" });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  useEffect(() => {
    if (websiteId) {
      fetchThirdPartyIntegrations();
    }
  }, [websiteId]);

  const fetchThirdPartyIntegrations = async () => {
    if (!websiteId) return;
    try {
      setLoadingThirdParty(true);
      const res = await fetch(`/api/websites/${websiteId}/seo/integrations`);
      if (res.ok) {
        const data = await res.json();
        setThirdPartyIntegrations(data.integrations || []);
        setSupportedProviders(data.supportedProviders || []);
      }
    } catch (err) {
      console.error("Fetch third party integrations error:", err);
    } finally {
      setLoadingThirdParty(false);
    }
  };

  const handleConnectGsc = () => {
    if (!websiteId) return;
    window.location.href = `/api/seo/gsc/connect?website_id=${websiteId}&redirect=1`;
  };

  const handleDisconnectGsc = async () => {
    if (confirm("Are you sure you want to disconnect Google Search Console?")) {
      await onSaveIntegration("google_search_console", "disconnected", {});
    }
  };

  const openConnectModal = (providerId: string = "ahrefs") => {
    setSelectedProviderId(providerId);
    setCredentialValues({});
    setStatusMessage(null);
    setIsModalOpen(true);
  };

  const handleConnectThirdParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteId) return;

    try {
      setIsConnecting(true);
      setStatusMessage(null);

      const res = await fetch(`/api/websites/${websiteId}/seo/integrations/${selectedProviderId}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentialValues),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to connect provider.");
      }

      setStatusMessage({ type: "success", text: data.message || "Connected successfully!" });
      await fetchThirdPartyIntegrations();
      setTimeout(() => {
        setIsModalOpen(false);
      }, 1500);
    } catch (err: any) {
      console.error("Connect error:", err);
      setStatusMessage({ type: "error", text: err.message || "Connection failed." });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTestThirdParty = async (providerId: string) => {
    if (!websiteId) return;
    try {
      setIsTesting(true);
      setStatusMessage(null);

      const res = await fetch(`/api/websites/${websiteId}/seo/integrations/${providerId}/test`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Connection test failed.");
      }

      setStatusMessage({ type: "success", text: data.message || "Connection test successful!" });
      await fetchThirdPartyIntegrations();
    } catch (err: any) {
      console.error("Test connection error:", err);
      setStatusMessage({ type: "error", text: err.message || "Connection test failed." });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnectThirdParty = async (providerId: string) => {
    if (!websiteId) return;
    if (!confirm(`Are you sure you want to disconnect ${providerId}?`)) return;

    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/integrations/${providerId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect.");
      }

      await fetchThirdPartyIntegrations();
    } catch (err: any) {
      console.error("Disconnect error:", err);
      alert(err.message || "Failed to disconnect integration.");
    }
  };

  const handleRequestIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteId) return;

    try {
      setIsSubmittingRequest(true);
      setStatusMessage(null);

      const res = await fetch(`/api/websites/${websiteId}/seo/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit request.");
      }

      setStatusMessage({ type: "success", text: "Integration request submitted successfully!" });
      setRequestForm({ toolName: "", toolWebsite: "", apiDocsUrl: "", message: "" });
      setTimeout(() => setIsModalOpen(false), 1500);
    } catch (err: any) {
      console.error("Request integration error:", err);
      setStatusMessage({ type: "error", text: err.message || "Failed to submit request." });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const activeProvider = supportedProviders.find((p) => p.id === selectedProviderId) || supportedProviders[0];

  return (
    <div className="space-y-8">
      {/* 1. GOOGLE ANALYTICS & TAG MANAGER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Google Analytics & Tracking Tags
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Tracking scripts are automatically injected into published site pages.
            </p>
          </div>

          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              gaId || gtmId
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-50 text-slate-500 border-slate-200"
            }`}
          >
            {gaId || gtmId ? "Tags Active" : "Not Configured"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GA4 */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                Google Analytics 4 (GA4)
              </span>
              <span className="text-[11px] font-mono text-slate-400">Measurement ID</span>
            </div>
            <div>
              <input
                type="text"
                value={gaId}
                onChange={(e) => onUpdateGaId(e.target.value)}
                placeholder="G-XXXXXXXXXX"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <p className="text-xs text-slate-500">
              Format: <code className="bg-white px-1 py-0.5 rounded border border-slate-200">G-XXXXXXXXXX</code>
            </p>
          </div>

          {/* GTM */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                Google Tag Manager (GTM)
              </span>
              <span className="text-[11px] font-mono text-slate-400">Container ID</span>
            </div>
            <div>
              <input
                type="text"
                value={gtmId}
                onChange={(e) => onUpdateGtmId(e.target.value)}
                placeholder="GTM-XXXXXXX"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <p className="text-xs text-slate-500">
              Format: <code className="bg-white px-1 py-0.5 rounded border border-slate-200">GTM-XXXXXXX</code>
            </p>
          </div>

          {/* GSC Verification Meta Tag */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 col-span-1 md:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Google Search Console HTML Verification Meta Tag
              </span>
              <span className="text-[11px] font-mono text-slate-400">Meta Tag Token</span>
            </div>
            <div>
              <input
                type="text"
                value={gscVerificationToken || ""}
                onChange={(e) => onUpdateGscVerificationToken && onUpdateGscVerificationToken(e.target.value)}
                placeholder="e.g. ODXf_Oowi3i3g-gHB_PaUZ6IvHCXfUMRVCUC_G14qBk"
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <p className="text-xs text-slate-500">
              Injects <code className="bg-white px-1 py-0.5 rounded border border-slate-200">&lt;meta name="google-site-verification" content="..."&gt;</code> into this website's published HTML <code className="bg-white px-1 py-0.5 rounded border border-slate-200">&lt;head&gt;</code>.
            </p>
          </div>
        </div>
      </div>

      {/* 2. GOOGLE SEARCH CONSOLE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Google Search Console Integration
        </h3>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-900 text-sm">Google Search Console</span>
              {gscStatus === "connected" ? (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  Connected ✓
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                  Disconnected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 max-w-xl">
              Connect Google Search Console via OAuth to import organic clicks, impressions, CTR, and search keyword query positions.
            </p>
            {selectedProperty && (
              <span className="inline-block text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 mt-1">
                Property: {selectedProperty}
              </span>
            )}
          </div>

          <div>
            {gscStatus === "connected" ? (
              <button
                type="button"
                onClick={handleDisconnectGsc}
                className="py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition-all"
              >
                Disconnect Search Console
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectGsc}
                className="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-all"
              >
                Connect Search Console
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. THIRD-PARTY SEO TOOLS (PHASE 10) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Third-Party SEO Tools
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Already using another SEO platform? Connect your own SEO tools to bring additional SEO data and insights into Codeaxys.
            </p>
          </div>

          <button
            type="button"
            onClick={() => openConnectModal("ahrefs")}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0"
          >
            <span>+ Connect SEO Tool</span>
          </button>
        </div>

        {/* Customer Billing Disclaimer Banner */}
        <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-start gap-3">
          <span className="text-base shrink-0">💡</span>
          <div>
            <strong>Customer Account Billing Model:</strong> Your third-party subscription and API usage are billed directly by the provider under your own account. Codeaxys does not provide or pay for third-party API credits.
          </div>
        </div>

        {/* Supported Provider Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {supportedProviders.map((provider) => {
            const connectedRecord = thirdPartyIntegrations.find((i) => i.provider === provider.id);
            const isConnected = !!connectedRecord && connectedRecord.status === "connected";
            const isError = !!connectedRecord && connectedRecord.status === "error";

            return (
              <div
                key={provider.id}
                className="p-5 bg-slate-50 border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-sm">{provider.name}</span>
                    {isConnected ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                        Connected ✓
                      </span>
                    ) : isError ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full">
                        Error
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full">
                        Not Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">{provider.description}</p>

                  {/* Capabilities Tags */}
                  <div className="flex items-center gap-1 flex-wrap mb-3">
                    {provider.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="px-2 py-0.5 bg-white border border-slate-200 text-[10px] font-mono font-medium text-slate-600 rounded uppercase"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>

                  {connectedRecord?.masked_credential && (
                    <div className="p-2 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-700 flex items-center justify-between">
                      <span className="text-slate-400">Key:</span>
                      <strong className="text-slate-900">{connectedRecord.masked_credential}</strong>
                    </div>
                  )}
                </div>

                <div>
                  {provider.id === "other" ? (
                    <button
                      type="button"
                      onClick={() => openConnectModal("other")}
                      className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-all"
                    >
                      Request Integration
                    </button>
                  ) : isConnected ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => handleTestThirdParty(provider.id)}
                        disabled={isTesting}
                        className="w-full py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-all"
                      >
                        {isTesting ? "Testing..." : "Test Connection"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDisconnectThirdParty(provider.id)}
                        className="w-full py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition-all"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openConnectModal(provider.id)}
                      className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-all"
                    >
                      Connect {provider.name}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. MODAL DRAWER FOR CONNECTING / REQUESTING THIRD-PARTY TOOLS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {selectedProviderId === "other" ? "Request New SEO Tool Integration" : `Connect ${activeProvider?.name || "SEO Tool"}`}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-xl"
              >
                ×
              </button>
            </div>

            {/* Status Messages */}
            {statusMessage && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center justify-between ${
                  statusMessage.type === "success"
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border border-rose-200 text-rose-800"
                }`}
              >
                <span>{statusMessage.text}</span>
                <button type="button" onClick={() => setStatusMessage(null)} className="font-bold">
                  ×
                </button>
              </div>
            )}

            {/* Provider Selector Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 pb-2">
              {supportedProviders.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedProviderId(p.id);
                    setStatusMessage(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    selectedProviderId === p.id
                      ? "bg-purple-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {selectedProviderId === "other" ? (
              /* REQUEST INTEGRATION FORM */
              <form onSubmit={handleRequestIntegration} className="space-y-4">
                <p className="text-xs text-slate-600">
                  Don't see your preferred SEO software? Submit your requested tool name and API documentation URL. Our engineering team will review it for future provider adapters.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">SEO Tool / Platform Name *</label>
                  <input
                    type="text"
                    required
                    value={requestForm.toolName}
                    onChange={(e) => setRequestForm((prev) => ({ ...prev, toolName: e.target.value }))}
                    placeholder="e.g. Screaming Frog, SE Ranking, Majestic"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Platform Website URL</label>
                  <input
                    type="url"
                    value={requestForm.toolWebsite}
                    onChange={(e) => setRequestForm((prev) => ({ ...prev, toolWebsite: e.target.value }))}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">API Documentation URL (Optional)</label>
                  <input
                    type="url"
                    value={requestForm.apiDocsUrl}
                    onChange={(e) => setRequestForm((prev) => ({ ...prev, apiDocsUrl: e.target.value }))}
                    placeholder="https://example.com/api-docs"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Request Details / Use Case</label>
                  <textarea
                    rows={2}
                    value={requestForm.message}
                    onChange={(e) => setRequestForm((prev) => ({ ...prev, message: e.target.value }))}
                    placeholder="Which metrics or features do you want imported?"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRequest}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all"
                  >
                    {isSubmittingRequest ? "Submitting..." : "Submit Integration Request"}
                  </button>
                </div>
              </form>
            ) : (
              /* CONNECT PROVIDER CREDENTIALS FORM */
              <form onSubmit={handleConnectThirdParty} className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {activeProvider?.description}
                </p>

                {activeProvider?.credentialFields.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">{field.label} *</label>
                    <input
                      type={field.type}
                      required={field.required}
                      value={credentialValues[field.key] || ""}
                      onChange={(e) =>
                        setCredentialValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    {field.helpText && <p className="text-[11px] text-slate-400">{field.helpText}</p>}
                  </div>
                ))}

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 leading-snug">
                  {activeProvider?.billingDisclaimer}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isConnecting}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all flex items-center gap-1.5"
                  >
                    {isConnecting ? "Connecting & Testing..." : `Save & Connect ${activeProvider?.name}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
