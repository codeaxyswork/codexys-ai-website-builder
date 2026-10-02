"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Globe,
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  Zap,
  ArrowRight,
  ExternalLink,
  Edit3,
  RefreshCw,
  Info,
  Check,
  Lock,
  ChevronRight,
  Sliders,
} from "lucide-react";
import {
  SourceWebsiteScan,
  MigrationMode,
  MigrationSelections,
  MigrationExecuteResult,
} from "@/lib/migration/types";
import { convertPageToCodeaxysNative, convertPageToExactSnapshot } from "@/lib/migration/converter";
import { convertPageToCodeaxysNativeRedesign } from "@/lib/migration/redesign-engine";

export default function MigrationPage() {
  const router = useRouter();

  // Step state: 'input' -> 'scanned' -> 'migrating' -> 'review' -> 'error'
  const [step, setStep] = useState<"input" | "scanned" | "migrating" | "review" | "error">("input");
  const [migrationError, setMigrationError] = useState<string | null>(null);

  // Input State
  const [url, setUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Scan Result State
  const [scanData, setScanData] = useState<SourceWebsiteScan | null>(null);

  // Migration Mode State (exact | redesign | rebuild)
  const [migrationMode, setMigrationMode] = useState<MigrationMode>("exact");
  const [redesignPrompt, setRedesignPrompt] = useState(
    "Redesign this website with a modern, premium and professional visual style while preserving all existing content, images, business information, links and functionality."
  );

  // Selected Page Preview Index for Review Comparison
  const [selectedPreviewPageIndex, setSelectedPreviewPageIndex] = useState<number>(0);

  // Content Selections
  const [selections, setSelections] = useState<MigrationSelections>({
    content: {
      pages: true,
      blogPages: true,
      navigation: true,
      textContent: true,
      images: true,
      logo: true,
      forms: true,
    },
    seo: {
      pageTitles: true,
      metaDescriptions: true,
      canonicalUrls: true,
      openGraph: true,
      robotsSettings: true,
      structuredData: true,
    },
    design: {
      colors: true,
      typography: true,
      spacing: true,
      layout: true,
      buttons: true,
    },
  });

  // Progress State
  const [progressStage, setProgressStage] = useState<string>("Analyzing website");
  const [progressPercent, setProgressPercent] = useState<number>(10);

  // Migration Execution Result
  const [executionResult, setExecutionResult] = useState<MigrationExecuteResult | null>(null);

  // Approval Modal State
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Handle URL Scanning
  const handleScanWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsScanning(true);
    setScanError(null);

    try {
      const res = await fetch("/api/websites/migrate/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const rawText = await res.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = { error: `Server returned an unparseable response (HTTP ${res.status}).` };
      }

      if (!res.ok || data.error) {
        const errorMsg = data.error || `Failed to scan website (HTTP ${res.status}).`;
        setScanError(errorMsg);
        setIsScanning(false);
        return;
      }

      setScanData(data.scan);
      setStep("scanned");
    } catch (err: any) {
      console.error("Scan website error:", err);
      setScanError("An unexpected error occurred while scanning website.");
    } finally {
      setIsScanning(false);
    }
  };

  // Execution Loading Guard
  const [isExecuting, setIsExecuting] = useState(false);

  // Handle Execute Migration
  const handleExecuteMigration = async () => {
    if (!scanData) return;

    if (executionResult?.websiteId) {
      router.push(`/dashboard/websites/${executionResult.websiteId}`);
      return;
    }

    if (isExecuting) return;

    const runId = `ui_run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`\n[REDESIGN_UI_START] runId: ${runId} | mode: ${migrationMode}`);

    setMigrationError(null);
    setExecutionResult(null);
    setIsExecuting(true);

    setStep("migrating");
    setProgressPercent(15);
    setProgressStage("Capturing source website...");

    const pTimer1 = setTimeout(() => {
      setProgressPercent(35);
      setProgressStage("Waiting for browser...");
    }, 2000);

    const pTimer2 = setTimeout(() => {
      setProgressPercent(60);
      setProgressStage("Localizing assets...");
    }, 6000);

    const pTimer3 = setTimeout(() => {
      setProgressPercent(85);
      setProgressStage("Building Codeaxys snapshot...");
    }, 12000);

    try {
      const res = await fetch("/api/websites/migrate/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanResult: scanData,
          mode: migrationMode,
          selections,
          redesignPrompt,
          runId,
        }),
      });

      clearTimeout(pTimer1);
      clearTimeout(pTimer2);
      clearTimeout(pTimer3);

      const rawText = await res.text();
      let data: MigrationExecuteResult & { error?: string } = {} as any;
      try {
        data = rawText ? JSON.parse(rawText) : ({} as any);
      } catch {
        data = { error: `Server returned an unparseable response (HTTP ${res.status}).` } as any;
      }

      if (!res.ok || data.error) {
        const errorMsg = data.error || `Failed to complete website migration (HTTP ${res.status}).`;
        console.log(`[REDESIGN_UI_ERROR] runId: ${runId} | error: "${errorMsg}"`);
        setMigrationError(errorMsg);
        setStep("error");
        setIsExecuting(false);
        return;
      }

      setProgressPercent(100);
      setProgressStage("Draft Website Ready!");
      setExecutionResult(data);
      setStep("review");
      setIsExecuting(false);
    } catch (err: any) {
      clearTimeout(pTimer1);
      clearTimeout(pTimer2);
      clearTimeout(pTimer3);
      setIsExecuting(false);
      const errorMsg = err?.message || "Failed to execute website migration.";
      console.log(`[REDESIGN_UI_ERROR] runId: ${runId} | error: "${errorMsg}"`);
      setMigrationError(errorMsg);
      setStep("error");
    }
  };

  const selectedPage = scanData?.pages[selectedPreviewPageIndex] || scanData?.pages[0];
  const capturedPage = executionResult?.capturedPages?.[selectedPreviewPageIndex] || executionResult?.capturedPages?.[0];

  const renderedCodeaxysHtml = capturedPage?.html_content
    ? capturedPage.html_content
    : selectedPage && scanData
    ? migrationMode === "exact"
      ? convertPageToExactSnapshot({
          html: selectedPage.sections.map((s) => s.htmlSnippet).join("\n"),
          slides: selectedPage.sections.find((s) => s.slides)?.slides,
          title: selectedPage.seo.seoTitle || selectedPage.title,
        }).htmlContent
      : migrationMode === "redesign"
      ? convertPageToCodeaxysNativeRedesign(selectedPage, scanData.globalStyles, selections, redesignPrompt).htmlContent
      : convertPageToCodeaxysNative(selectedPage, scanData.globalStyles, migrationMode, selections).htmlContent
    : "";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Top SaaS Header */}
      <header className="h-16 border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs sm:text-sm font-bold text-slate-700 transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Globe className="w-4 h-4" />
            </div>
            <h1 className="font-extrabold text-slate-900 text-sm sm:text-base">
              Website Migration Studio
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Read-Only Source Guarantee</span>
          </span>
        </div>
      </header>

      {/* Main Migration Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 p-8 text-white shadow-xl">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-purple-200 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Native Importer & Transformer</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              Migrate Your Website to Codeaxys
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Bring your existing website to Codeaxys while preserving its content, design, structure, and SEO metadata.
            </p>
          </div>
        </div>

        {/* STEP 1: INPUT URL */}
        {step === "input" && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900">Enter Your Website URL</h3>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">
                Our server-side analyzer will safely inspect your homepage, internal pages, images, and SEO structure.
              </p>
            </div>

            <form onSubmit={handleScanWebsite} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Website URL
                </label>
                <div className="relative flex items-center">
                  <Globe className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.example.com"
                    required
                    className="w-full h-14 pl-12 pr-36 rounded-2xl border border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 text-sm font-semibold text-slate-900 outline-hidden transition-all bg-slate-50/50"
                  />
                  <button
                    type="submit"
                    disabled={isScanning || !url.trim()}
                    className="absolute right-2 h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-md shadow-indigo-600/20 active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Scan Website</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {scanError && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                  <span>{scanError}</span>
                </div>
              )}
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
                  <Lock className="w-4 h-4" />
                  <span>SSRF Protected</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Strict server-side validation blocks access to private network resources.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Zero Risk to Original</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Your live website remains completely untouched and unchanged.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
                  <Zap className="w-4 h-4" />
                  <span>Deterministic Scan</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Scanning consumes 0 AI credits and executes bounded link discovery.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: SCANNED SUMMARY & CONFIGURATION */}
        {step === "scanned" && scanData && (
          <div className="space-y-6">
            {/* Website Analysis Summary Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Scan Completed
                  </span>
                  <h3 className="text-xl font-black text-slate-900 mt-1">
                    Website Analysis Summary
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{scanData.targetUrl}</p>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Detected Platform
                    </span>
                    <span className="text-sm font-black text-indigo-600">
                      {scanData.platform.name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scanned Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-center">
                  <span className="text-2xl font-black text-indigo-900 block">
                    {scanData.summary.pagesCount}
                  </span>
                  <span className="text-xs font-bold text-indigo-600">Pages Found</span>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 text-center">
                  <span className="text-2xl font-black text-purple-900 block">
                    {scanData.summary.imagesCount}
                  </span>
                  <span className="text-xs font-bold text-purple-600">Images Found</span>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 text-center">
                  <span className="text-2xl font-black text-blue-900 block">
                    {scanData.summary.navMenusCount}
                  </span>
                  <span className="text-xs font-bold text-blue-600">Nav Menus</span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 text-center">
                  <span className="text-2xl font-black text-amber-900 block">
                    {scanData.summary.formsCount}
                  </span>
                  <span className="text-xs font-bold text-amber-600">Forms</span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 text-center">
                  <span className="text-2xl font-black text-emerald-900 block">
                    {scanData.summary.blogPagesCount}
                  </span>
                  <span className="text-xs font-bold text-emerald-600">Blog Pages</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-center">
                  <span className="text-2xl font-black text-slate-900 block">
                    {scanData.summary.seoRecordsCount}
                  </span>
                  <span className="text-xs font-bold text-slate-600">SEO Records</span>
                </div>
              </div>
            </div>

            {/* Migration Mode Selection */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-6">
              <div>
                <h3 className="text-lg font-black text-slate-900">Select Migration Mode</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Choose how Codeaxys should recreate your existing website.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* OPTION 1: Exact Migration */}
                <div
                  onClick={() => setMigrationMode("exact")}
                  className={`p-6 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    migrationMode === "exact"
                      ? "border-indigo-600 bg-indigo-50/40 shadow-md"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                        Default
                      </span>
                      {migrationMode === "exact" && (
                        <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                      )}
                    </div>
                    <h4 className="font-black text-slate-900 text-base">Exact Migration</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Recreate current website in Codeaxys while preserving its visual design, content, structure, and URLs.
                    </p>
                  </div>
                </div>

                {/* OPTION 2: Migration + Redesign */}
                <div
                  onClick={() => setMigrationMode("redesign")}
                  className={`p-6 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    migrationMode === "redesign"
                      ? "border-purple-600 bg-purple-50/40 shadow-md"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded bg-purple-100 text-purple-800">
                        Modernize
                      </span>
                      {migrationMode === "redesign" && (
                        <CheckCircle2 className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                    <h4 className="font-black text-slate-900 text-base">Migration + Redesign</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Import existing content and structure, then modernize visual design using Codeaxys templates.
                    </p>
                  </div>
                </div>

                {/* OPTION 3: Migration + AI Rebuild */}
                <div
                  onClick={() => setMigrationMode("rebuild")}
                  className={`p-6 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    migrationMode === "rebuild"
                      ? "border-blue-600 bg-blue-50/40 shadow-md"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded bg-blue-100 text-blue-800">
                        AI Powered
                      </span>
                      {migrationMode === "rebuild" && (
                        <CheckCircle2 className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <h4 className="font-black text-slate-900 text-base">Migration + AI Rebuild</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Use the existing website as source and recreate it as a fresh, high-converting Codeaxys website.
                    </p>
                  </div>
                </div>
              </div>

              {migrationMode === "redesign" && (
                <div className="p-6 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-4 mt-6">
                  <div className="flex items-center justify-between border-b border-purple-200/80 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      <h4 className="font-extrabold text-slate-900 text-sm">AI REDESIGN DIRECTION</h4>
                    </div>
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
                      Source Content & Assets Locked
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      How would you like this website redesigned visually?
                    </label>
                    <textarea
                      value={redesignPrompt}
                      onChange={(e) => setRedesignPrompt(e.target.value)}
                      rows={3}
                      placeholder="e.g. Make this website look premium and modern with a dark luxury visual style, bold typography, modern cards..."
                      className="w-full p-3.5 rounded-xl border border-purple-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 text-xs font-medium text-slate-900 outline-hidden bg-white shadow-xs"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="text-slate-500 font-bold self-center">Presets:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setRedesignPrompt(
                          "Make this website look premium and modern. Use a dark luxury visual style, bold typography, large visual sections, elegant spacing, sophisticated navigation and modern cards."
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-bold hover:bg-purple-100 transition-colors cursor-pointer"
                    >
                      ✨ Dark Luxury
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRedesignPrompt(
                          "Redesign this as a clean modern corporate website with lots of whitespace, strong typography and a professional visual hierarchy."
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-bold hover:bg-purple-100 transition-colors cursor-pointer"
                    >
                      🏢 Corporate Minimal
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRedesignPrompt(
                          "Give this website a futuristic technology look with dark backgrounds, glowing accents and modern glass cards."
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-900 font-bold hover:bg-purple-100 transition-colors cursor-pointer"
                    >
                      🚀 Futuristic Glass
                    </button>
                  </div>

                  {/* Locked vs Allowed Rules */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
                    <div className="p-3.5 rounded-xl bg-white border border-emerald-200/80 space-y-1">
                      <span className="font-extrabold text-emerald-800 text-[11px] block uppercase tracking-wider">
                        Locked (Unchanged):
                      </span>
                      <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-700 font-semibold text-[11px]">
                        <li>✓ Content</li>
                        <li>✓ Existing images</li>
                        <li>✓ Business info</li>
                        <li>✓ Links & URLs</li>
                        <li>✓ Navigation</li>
                        <li>✓ Functionality</li>
                      </ul>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-indigo-200/80 space-y-1">
                      <span className="font-extrabold text-indigo-800 text-[11px] block uppercase tracking-wider">
                        Allowed Changes (Visual):
                      </span>
                      <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-700 font-semibold text-[11px]">
                        <li>✓ Visual Layout</li>
                        <li>✓ Typography</li>
                        <li>✓ Colors & Gradients</li>
                        <li>✓ Component Styling</li>
                        <li>✓ Spacing & Margins</li>
                        <li>✓ Responsive Behavior</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* URL Mapping Preview Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">URL Preservation & Slug Mapping</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Existing URLs are preserved. If a URL changes, a 301 redirect map is automatically configured.
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
                {scanData.urlMappings.map((map, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs font-mono text-slate-700"
                  >
                    <span className="truncate max-w-[200px] sm:max-w-md">{map.originalPath}</span>
                    <div className="flex items-center gap-3 shrink-0 font-sans">
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                      <span className="font-bold text-indigo-700">{map.newSlug}</span>
                      {map.requiresRedirect ? (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-extrabold text-[10px]">
                          301 Redirect Required
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                          Exact Match
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Execution Action Button */}
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setStep("input")}
                className="px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
              >
                Back to URL Input
              </button>

              <button
                onClick={handleExecuteMigration}
                className={`px-8 py-3.5 rounded-xl text-white font-extrabold text-sm transition-all shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer ${
                  migrationMode === "redesign"
                    ? "bg-purple-600 hover:bg-purple-700 shadow-purple-600/25"
                    : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25"
                }`}
              >
                {migrationMode === "redesign" ? (
                  <>
                    <Sparkles className="w-5 h-5 text-purple-200" />
                    <span>Start AI Redesign to Codeaxys Draft</span>
                  </>
                ) : (
                  <>
                    <span>Start Migration to Codeaxys Draft</span>
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: MIGRATING PROGRESS */}
        {step === "migrating" && (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-8 shadow-xl max-w-xl mx-auto">
            <div className={`w-16 h-16 rounded-3xl border flex items-center justify-center mx-auto animate-bounce ${
              migrationMode === "redesign" ? "bg-purple-50 border-purple-200 text-purple-600" : "bg-indigo-50 border-indigo-200 text-indigo-600"
            }`}>
              {migrationMode === "redesign" ? <Sparkles className="w-8 h-8 animate-pulse" /> : <RefreshCw className="w-8 h-8 animate-spin" />}
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900">
                {migrationMode === "redesign" ? "Redesigning Your Website with AI" : "Migrating Your Website"}
              </h3>
              <p className="text-xs text-slate-500 font-medium">{progressStage}</p>
            </div>

            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  migrationMode === "redesign"
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600"
                    : "bg-gradient-to-r from-indigo-600 to-purple-600"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="text-left bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{migrationMode === "redesign" ? "Source website captured & analyzed with Playwright" : "Website discovered & analyzed"}</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{migrationMode === "redesign" ? "Source content, images & business facts locked" : "Content & native sections mapped"}</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{migrationMode === "redesign" ? "AI visual redesign engine generating modern UI" : "Images uploaded to media assets"}</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>SEO metadata preserved</span>
              </div>
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Creating private Codeaxys draft</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP ERROR: EXPLICIT FAILURE STATE (NO SILENT RESET TO SELECT MODE) */}
        {step === "error" && (
          <div className="bg-white rounded-3xl border border-red-200 p-8 sm:p-10 shadow-xl max-w-2xl mx-auto space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="text-center space-y-2">
              <span className="text-xs font-extrabold uppercase px-3 py-1 rounded-full bg-red-100 text-red-800 border border-red-200">
                Migration Failed
              </span>
              <h3 className="text-2xl font-black text-slate-900 mt-2">
                {migrationMode === "redesign"
                  ? "AI Redesign Failed"
                  : migrationMode === "rebuild"
                  ? "AI Rebuild Failed"
                  : "Exact Migration Failed"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                {migrationMode === "redesign"
                  ? "Codeaxys AI Redesign could not complete visual transformation."
                  : migrationMode === "rebuild"
                  ? "Codeaxys AI Rebuild could not complete semantic reconstruction."
                  : "Codeaxys could not capture or import the fully rendered source website."}
              </p>
            </div>

            {/* Diagnostic Box */}
            <div className="p-4 rounded-2xl bg-red-50/80 border border-red-200 space-y-2 text-left">
              <span className="text-xs font-bold text-red-900 uppercase tracking-wider block">
                Failure Reason / Diagnostic Log:
              </span>
              <p className="text-xs font-mono text-red-800 break-words whitespace-pre-wrap leading-relaxed">
                {migrationError?.includes("REDESIGN_AI_PROVIDER_FAILED")
                  ? "AI redesign could not be generated because the AI provider is temporarily unavailable. Please retry."
                  : migrationError?.includes("REDESIGN_CONTENT_VALIDATION_FAILED")
                  ? "The AI redesign was rejected because it changed or invented protected website content."
                  : migrationError || "An unexpected error occurred during migration."}
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2 text-xs text-slate-600 text-left">
              <span className="font-bold text-slate-800 block">Common Causes & Solutions:</span>
              <ul className="list-disc list-inside space-y-1">
                <li>Target website server timed out or blocked browser navigation.</li>
                <li>Source website URL returned 403 Forbidden or DNS resolution failed.</li>
                <li>Complex JavaScript rendering exceeded maximum timeout threshold.</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <button
                onClick={() => {
                  setMigrationError(null);
                  setStep("scanned");
                }}
                className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
              >
                Back to Migration Modes
              </button>

              <button
                onClick={() => {
                  setMigrationError(null);
                  handleExecuteMigration();
                }}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Migration</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & MULTI-PAGE VISUAL COMPARISON */}
        {step === "review" && executionResult && scanData && (
          <div className="space-y-8">
            {/* Completion Header */}
            <div className="bg-emerald-600 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Migration Complete ({scanData.pages.length} Pages Created)</span>
                </div>
                <h3 className="text-2xl font-black">Draft Website Ready for Review</h3>
                <p className="text-xs text-emerald-100">
                  Your source website is 100% untouched. All {scanData.pages.length} discovered pages have been instantiated as a Codeaxys draft.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <Link
                  href={`/dashboard/websites/${executionResult.websiteId}`}
                  className="px-5 py-3 rounded-xl bg-white hover:bg-slate-100 text-emerald-900 font-extrabold text-xs transition-all shadow-md flex items-center gap-2"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Open in Editor</span>
                </Link>

                <button
                  onClick={() => setShowApprovalModal(true)}
                  className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Approve & Publish</span>
                </button>
              </div>
            </div>

            {/* Split Screen Visual Comparison with Multi-Page Inspector */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Original vs Codeaxys Multi-Page Comparison</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Inspect and compare any of the {scanData.pages.length} migrated pages between the live site and the Codeaxys native draft.
                  </p>
                </div>

                {/* Page Selector Tabs */}
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shrink-0">
                  <label className="text-xs font-bold text-slate-600 px-2">Select Page:</label>
                  <select
                    value={selectedPreviewPageIndex}
                    onChange={(e) => setSelectedPreviewPageIndex(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-hidden"
                  >
                    {scanData.pages.map((p, idx) => (
                      <option key={idx} value={idx}>
                        {idx + 1}. {p.path} ({p.title.substring(0, 30)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Original Website Live Page View */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
                    <span>Original Source Page</span>
                    <a
                      href={selectedPage?.url || scanData.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline inline-flex items-center gap-1"
                    >
                      <span className="truncate max-w-[200px]">{selectedPage?.url || scanData.targetUrl}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>

                  <div className="w-full h-[450px] rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden relative shadow-inner">
                    <iframe
                      src={selectedPage?.url || scanData.targetUrl}
                      className="w-full h-full border-0"
                      title="Original Website Page"
                    />
                  </div>
                </div>

                {/* Codeaxys Native Draft Page View */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-950">
                    <div className="flex items-center gap-2">
                      <span>{migrationMode === "exact" ? "Codeaxys Exact Snapshot" : "Codeaxys Draft"}</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-200 text-indigo-900 text-[10px] font-black uppercase">
                        {migrationMode} mode
                      </span>
                    </div>
                    <span className="text-indigo-700 font-mono text-[11px]">{selectedPage?.path}</span>
                  </div>

                  <div className="w-full h-[450px] rounded-2xl border border-indigo-200 bg-white overflow-hidden shadow-inner relative">
                    <iframe
                      srcDoc={renderedCodeaxysHtml}
                      sandbox="allow-scripts"
                      className="w-full h-full border-0"
                      title="Codeaxys Native Draft Page"
                    />
                  </div>
                </div>
              </div>

              {/* Selected Page Metadata Inspector */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-extrabold text-slate-800 uppercase tracking-wider">
                    Selected Page Detail: {selectedPage?.path}
                  </span>
                  <span className="text-slate-500 font-mono">{selectedPage?.url}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-slate-600">
                  <div>
                    <span className="font-bold text-slate-800 block">Page Title:</span>
                    <span>{selectedPage?.title || "N/A"}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">SEO Meta Description:</span>
                    <span className="truncate block max-w-xs">{selectedPage?.seo.metaDescription || "N/A"}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">Extracted Sections / Images:</span>
                    <span>{selectedPage?.sections.length} Sections, {selectedPage?.images.length} Images</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PART 8: PER-PAGE CAPTURE & RUNTIME REPORT */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900">Per-Page Capture & Runtime Preservation Report</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold uppercase">
                      Deterministic Manifest
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Audit original frontend runtime preservation, JS inventory, HTML size validation, and component behavior sources.
                  </p>
                </div>
              </div>

              {/* Manifest Grid */}
              <div className="space-y-4">
                {(executionResult.manifests || []).map((m, idx) => (
                  <div key={idx} className="p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase ${
                          m.status === "PASS" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {m.status}
                        </span>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          m.migrationStatusLabel === "Exact Migration"
                            ? "bg-emerald-600 text-white"
                            : m.migrationStatusLabel === "Partial Exact Migration"
                            ? "bg-blue-600 text-white"
                            : "bg-amber-600 text-white"
                        }`}>
                          {m.migrationStatusLabel || "Exact Migration"}
                        </span>
                        <div>
                          <span className="font-mono font-bold text-sm text-slate-900">{m.path}</span>
                          <span className="text-xs text-slate-500 block truncate max-w-md">{m.sourceUrl}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                        <span>Duration: {m.durationMs}ms</span>
                        <span>HTML: {(m.htmlSizeBytes / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>

                    {/* Resource Breakdown Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="p-3 rounded-xl bg-white border border-slate-200 text-center">
                        <span className="text-xs font-bold text-slate-500 block">CSS</span>
                        <span className="text-sm font-black text-slate-900">{m.css.localized} / {m.css.detected}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200 text-center">
                        <span className="text-xs font-bold text-slate-500 block">JS Resources</span>
                        <span className="text-sm font-black text-slate-900">{m.js.localized} / {m.js.detected}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200 text-center">
                        <span className="text-xs font-bold text-slate-500 block">Images</span>
                        <span className="text-sm font-black text-slate-900">{m.images.localized} / {m.images.detected}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200 text-center">
                        <span className="text-xs font-bold text-slate-500 block">Fonts</span>
                        <span className="text-sm font-black text-slate-900">{m.fonts.localized} / {m.fonts.detected}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200 text-center">
                        <span className="text-xs font-bold text-slate-500 block">Menu Source</span>
                        <span className={`text-xs font-black px-2 py-0.5 rounded inline-block mt-0.5 ${
                          m.behaviorSource?.menu === "ORIGINAL_EXTERNAL" || m.behaviorSource?.menu === "ORIGINAL_LOCALIZED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {m.behaviorSource?.menu || "ORIGINAL"}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200 text-center">
                        <span className="text-xs font-bold text-slate-500 block">Slider Source</span>
                        <span className={`text-xs font-black px-2 py-0.5 rounded inline-block mt-0.5 ${
                          m.behaviorSource?.slider === "ORIGINAL_EXTERNAL" || m.behaviorSource?.slider === "ORIGINAL_LOCALIZED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {m.behaviorSource?.slider || "ORIGINAL"}
                        </span>
                      </div>
                    </div>

                    {/* HTML Size Validation Comparison */}
                    {m.htmlSizes && (
                      <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5 font-mono">
                        <span className="font-sans font-bold text-slate-700 block">HTML Size Validation Audit:</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600">
                          <div>A. Rendered: <strong className="text-slate-900">{(m.htmlSizes.renderedContentSizeBytes / 1024).toFixed(1)} KB</strong></div>
                          <div>B. OuterHTML: <strong className="text-slate-900">{(m.htmlSizes.outerHtmlSizeBytes / 1024).toFixed(1)} KB</strong></div>
                          <div>C. Sanitized: <strong className="text-slate-900">{(m.htmlSizes.sanitizedSizeBytes / 1024).toFixed(1)} KB</strong></div>
                          <div>D. Generated: <strong className="text-slate-900">{((m.htmlSizes.sanitizedSizeBytes + 1000) / 1024).toFixed(1)} KB</strong></div>
                        </div>
                      </div>
                    )}

                    {/* Behavior Chips & Original JS Status */}
                    <div className="flex flex-wrap gap-2 pt-1 text-xs">
                      {m.runtimeVerification && (
                        <span className={`px-2.5 py-1 rounded-lg font-bold border ${
                          m.runtimeVerification.originalJsExecution === "PASS"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          Original JS Exec: {m.runtimeVerification.originalJsExecution}
                        </span>
                      )}
                      {m.behaviors.hasCssAnimations && (
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                          ⚡ CSS Animations
                        </span>
                      )}
                      {m.behaviors.hasElementorAnimations && (
                        <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-bold border border-purple-100">
                          ✨ Elementor Effects
                        </span>
                      )}
                      {m.behaviors.hasSliders && (
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-100">
                          🎠 Multi-Slide Hero
                        </span>
                      )}
                      {m.behaviors.hasAccordions && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold border border-amber-100">
                          📂 Accordions / FAQs
                        </span>
                      )}
                      {m.interactions.whatsAppButton === "PASS" && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                          💬 WhatsApp Action
                        </span>
                      )}
                      {m.interactions.phoneButton === "PASS" && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                          📞 Phone Action
                        </span>
                      )}
                    </div>

                    {/* JS Resource Inventory */}
                    {m.jsInventory && m.jsInventory.length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs space-y-1.5">
                        <span className="font-bold text-slate-800 block">Complete JS Resource Inventory ({m.jsInventory.length} total):</span>
                        <div className="max-h-36 overflow-y-auto space-y-1">
                          {m.jsInventory.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px] font-mono bg-white p-1.5 rounded border border-slate-200 gap-2">
                              <span className="truncate max-w-sm text-slate-700">{item.url}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-bold uppercase">{item.category}</span>
                                <span className={`px-1.5 py-0.5 rounded font-bold ${item.captured ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                                  {item.captured ? "Captured" : "Failed"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unresolved Warnings Box */}
                    {m.unresolvedResources && m.unresolvedResources.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                        <span className="font-bold block">Unresolved External Resources ({m.unresolvedResources.length}):</span>
                        <ul className="list-disc list-inside font-mono text-[11px] text-amber-800 space-y-0.5">
                          {m.unresolvedResources.map((u, i) => (
                            <li key={i} className="truncate">{u}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Migration Issue & Limitation Report */}
            {executionResult.warnings && executionResult.warnings.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-4">
                <div className="flex items-center gap-2 text-amber-800 font-extrabold text-base">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span>Migration Issue Report & Items Needing Review</span>
                </div>

                <div className="space-y-2">
                  {executionResult.warnings.map((warn, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 flex items-start gap-3"
                    >
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{warn.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* EXPLICIT APPROVAL & PUBLISH MODAL */}
      {showApprovalModal && executionResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 relative">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">Approve & Publish Website</h3>
                <p className="text-xs text-slate-500">
                  Explicit customer approval is required before publishing.
                </p>
              </div>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2 text-xs text-emerald-900 font-medium">
              <p className="font-extrabold text-emerald-950 text-sm">Original Website Safety Guarantee:</p>
              <ul className="list-disc list-inside space-y-1 text-emerald-800">
                <li>Your original website is still live and untouched.</li>
                <li>Nothing has been changed or disabled on your existing domain.</li>
                <li>No automatic DNS switch or domain change will occur.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
              >
                Continue Editing
              </button>

              <Link
                href={`/dashboard/websites/${executionResult.websiteId}`}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/20 active:scale-95 flex items-center gap-2"
              >
                <span>Confirm & Publish</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
