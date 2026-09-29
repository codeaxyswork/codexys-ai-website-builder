"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Calendar,
  Sparkles,
  Printer,
  Share2,
  CheckCircle2,
  TrendingUp,
  Award,
  Sliders,
  Building2,
  Copy,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Eye
} from "lucide-react";
import { SEOReportData, WhiteLabelConfig } from "@/lib/seo-reports/engine";

interface SEOReportsDashboardProps {
  websiteId: string;
}

export function SEOReportsDashboard({ websiteId }: SEOReportsDashboardProps) {
  const [reports, setReports] = useState<SEOReportData[]>([]);
  const [whiteLabel, setWhiteLabel] = useState<WhiteLabelConfig>({
    website_id: websiteId,
    agency_name: "Codeaxys Agency Suite",
    agency_logo_url: "",
    primary_color: "#7c3aed",
    custom_footer: "Powered by Codeaxys Enterprise SEO Intelligence Engine.",
    client_name: "Valued Client",
  });

  const [activeSubTab, setActiveSubTab] = useState<"reports" | "whitelabel">("reports");
  const [selectedReport, setSelectedReport] = useState<SEOReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingWl, setIsSavingWl] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchReportsData();
  }, [websiteId]);

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/websites/${websiteId}/seo/reports`);
      if (res.ok) {
        const data = await res.json();
        if (data.reports) setReports(data.reports);
        if (data.whiteLabel) setWhiteLabel((prev) => ({ ...prev, ...data.whiteLabel }));
      }
    } catch (err) {
      console.error("Failed to load reports data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (reportType: "weekly" | "monthly" | "on_demand") => {
    try {
      setIsGenerating(true);
      setStatusMessage(null);

      const res = await fetch(`/api/websites/${websiteId}/seo/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_type: reportType }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate report.");
      }

      const data = await res.json();
      if (data.report) {
        setReports((prev) => [data.report, ...prev]);
        setSelectedReport(data.report);
        setStatusMessage(`Generated ${reportType} SEO report successfully.`);
      }
    } catch (err: any) {
      console.error("Generate Report Error:", err);
      setStatusMessage(err.message || "Failed to generate report.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveWhiteLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingWl(true);
      setStatusMessage(null);

      const res = await fetch(`/api/websites/${websiteId}/seo/reports/white-label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(whiteLabel),
      });

      if (!res.ok) {
        throw new Error("Failed to save white label configuration.");
      }

      setStatusMessage("White label agency branding saved successfully.");
    } catch (err: any) {
      console.error("Save White Label Error:", err);
      setStatusMessage(err.message || "Failed to save white label config.");
    } finally {
      setIsSavingWl(false);
    }
  };

  const copyShareLink = (shareToken: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const shareUrl = `${origin}/api/seo/reports/shared/${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedToken(shareToken);
    setTimeout(() => setCopiedToken(null), 3000);
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
        <div className="inline-flex items-center gap-3 text-slate-600 font-medium">
          <RefreshCw className="w-5 h-5 animate-spin text-purple-600" />
          Loading SEO Reports & White Label Console...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" />
              <span>SEO Reports & Client View Suite</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Automated Reports & White Label Branding
            </h2>
            <p className="text-slate-300 text-sm max-w-2xl">
              Generate weekly & monthly client PDF reports, customize agency white-label logos, and share secure live client links.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => handleGenerateReport("weekly")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-sm rounded-xl transition-all shadow-md disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGenerating ? "Generating..." : "Generate Weekly Report"}</span>
            </button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => handleGenerateReport("monthly")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-sm rounded-xl border border-white/20 transition-all disabled:opacity-50"
            >
              <Calendar className="w-4 h-4" />
              <span>Monthly Report</span>
            </button>
          </div>
        </div>

        {/* SUB NAVIGATION TABS */}
        <div className="flex items-center gap-2 mt-8 pt-6 border-t border-white/10">
          <button
            type="button"
            onClick={() => setActiveSubTab("reports")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              activeSubTab === "reports"
                ? "bg-white text-slate-900 shadow-md"
                : "text-slate-300 hover:text-white hover:bg-white/10"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Generated Reports ({reports.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("whitelabel")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
              activeSubTab === "whitelabel"
                ? "bg-white text-slate-900 shadow-md"
                : "text-slate-300 hover:text-white hover:bg-white/10"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>White Label Agency Settings</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-sm font-semibold flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-purple-600 font-bold hover:text-purple-900">
            ×
          </button>
        </div>
      )}

      {/* SUB-TAB 1: GENERATED REPORTS */}
      {activeSubTab === "reports" && (
        <div className="space-y-6">
          {reports.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4 shadow-sm">
              <FileText className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-lg font-bold text-slate-800">No Reports Generated Yet</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Click "Generate Weekly Report" above to compile site intelligence, GSC analytics, and keyword rankings into a client-ready report.
              </p>
              <button
                type="button"
                onClick={() => handleGenerateReport("weekly")}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl transition-all shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate First Report</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 font-bold text-xs capitalize border border-purple-200">
                        <Calendar className="w-3.5 h-3.5" />
                        {report.report_type} Report
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 line-clamp-2">
                      {report.title}
                    </h4>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div className="p-2.5 bg-slate-50 rounded-xl text-center">
                        <span className="text-xs text-slate-400 font-medium block">SEO Score</span>
                        <span className="text-base font-extrabold text-purple-700">{report.seo_score}/100</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl text-center">
                        <span className="text-xs text-slate-400 font-medium block">Grade</span>
                        <span className="text-base font-extrabold text-emerald-600">{report.health_grade}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedReport(report)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Report</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => copyShareLink(report.share_token)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedToken === report.share_token ? "Copied Link!" : "Client Link"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: WHITE LABEL AGENCY SETTINGS */}
      {activeSubTab === "whitelabel" && (
        <form onSubmit={handleSaveWhiteLabel} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-900">White Label Agency Customization</h3>
            <p className="text-xs text-slate-500">
              Customize branding for client PDF reports and shareable live links.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Agency Name
              </label>
              <input
                type="text"
                value={whiteLabel.agency_name}
                onChange={(e) => setWhiteLabel({ ...whiteLabel, agency_name: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600"
                placeholder="e.g. Apex Digital Marketing"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Client Name / Company
              </label>
              <input
                type="text"
                value={whiteLabel.client_name || ""}
                onChange={(e) => setWhiteLabel({ ...whiteLabel, client_name: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600"
                placeholder="e.g. Acme Corporation"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Agency Logo Image URL
              </label>
              <input
                type="text"
                value={whiteLabel.agency_logo_url || ""}
                onChange={(e) => setWhiteLabel({ ...whiteLabel, agency_logo_url: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600"
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Primary Brand Accent Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={whiteLabel.primary_color || "#7c3aed"}
                  onChange={(e) => setWhiteLabel({ ...whiteLabel, primary_color: e.target.value })}
                  className="w-12 h-11 rounded-xl cursor-pointer border border-slate-200 p-1"
                />
                <input
                  type="text"
                  value={whiteLabel.primary_color || "#7c3aed"}
                  onChange={(e) => setWhiteLabel({ ...whiteLabel, primary_color: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-semibold uppercase"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Custom Report Footer Text
            </label>
            <textarea
              rows={3}
              value={whiteLabel.custom_footer || ""}
              onChange={(e) => setWhiteLabel({ ...whiteLabel, custom_footer: e.target.value })}
              className="w-full p-4 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600"
              placeholder="Custom footer message or disclaimer for clients..."
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSavingWl}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl transition-all shadow-md disabled:opacity-50"
            >
              {isSavingWl ? "Saving..." : "Save White Label Settings"}
            </button>
          </div>
        </form>
      )}

      {/* FULL-SCREEN REPORT VIEWER MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                {selectedReport.white_label.agency_logo_url ? (
                  <img src={selectedReport.white_label.agency_logo_url} alt="Logo" className="h-8 object-contain" />
                ) : (
                  <span className="font-black text-purple-700 text-lg">
                    {selectedReport.white_label.agency_name}
                  </span>
                )}
                <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full">
                  Client Report
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
                  title="Print / Save PDF"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700 rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </div>

            {/* REPORT BODY CONTENT */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{selectedReport.title}</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Prepared for {selectedReport.white_label.client_name} • Period: {new Date(selectedReport.period_start).toLocaleDateString()} – {new Date(selectedReport.period_end).toLocaleDateString()}
                </p>
              </div>

              {/* METRIC GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-purple-50/80 border border-purple-200/60 rounded-2xl text-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">SEO Score</span>
                  <span className="text-2xl font-black text-purple-700 block mt-1">{selectedReport.seo_score}/100</span>
                </div>
                <div className="p-4 bg-emerald-50/80 border border-emerald-200/60 rounded-2xl text-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Health Grade</span>
                  <span className="text-2xl font-black text-emerald-700 block mt-1">{selectedReport.health_grade}</span>
                </div>
                <div className="p-4 bg-blue-50/80 border border-blue-200/60 rounded-2xl text-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Impressions</span>
                  <span className="text-2xl font-black text-blue-700 block mt-1">{selectedReport.metrics.total_impressions.toLocaleString()}</span>
                </div>
                <div className="p-4 bg-amber-50/80 border border-amber-200/60 rounded-2xl text-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Resolved Fixes</span>
                  <span className="text-2xl font-black text-amber-700 block mt-1">{selectedReport.metrics.resolved_issues}</span>
                </div>
              </div>

              {/* EXECUTIVE SUMMARY */}
              <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Executive Summary</h4>
                <p className="text-sm text-slate-700 leading-relaxed">{selectedReport.executive_summary}</p>
              </div>

              {/* KEY ACHIEVEMENTS */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900">Key Performance Highlights</h4>
                <div className="space-y-2">
                  {selectedReport.key_achievements.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* TOP QUERIES TABLE */}
              {selectedReport.top_queries.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-900">Top Search Queries</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                        <tr>
                          <th className="p-3">Query</th>
                          <th className="p-3 text-right">Impressions</th>
                          <th className="p-3 text-right">Clicks</th>
                          <th className="p-3 text-right">CTR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedReport.top_queries.map((q, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-3 font-semibold text-slate-900">{q.query}</td>
                            <td className="p-3 text-right font-medium text-slate-600">{q.impressions}</td>
                            <td className="p-3 text-right font-bold text-purple-700">{q.clicks}</td>
                            <td className="p-3 text-right font-medium text-slate-600">{q.ctr}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* FOOTER DISCLAIMER */}
              <div className="pt-6 border-t border-slate-100 text-center text-xs text-slate-400 font-medium">
                {selectedReport.white_label.custom_footer}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
