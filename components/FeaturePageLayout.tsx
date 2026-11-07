"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  ChevronRight,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Zap,
  Globe,
  Code2,
  Layers,
  Layout,
  Smartphone,
  ShieldCheck,
  Laptop,
  Sliders,
  ArrowRightLeft,
  Settings2,
  SearchCheck,
  Bot,
  FileCheck2,
  Palette,
  Gauge,
  RotateCcw,
  FileCode,
  MousePointerClick,
  Undo2,
  type LucideIcon,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  zap: Zap,
  globe: Globe,
  code: Code2,
  layers: Layers,
  layout: Layout,
  smartphone: Smartphone,
  shield: ShieldCheck,
  laptop: Laptop,
  sliders: Sliders,
  arrowRightLeft: ArrowRightLeft,
  settings: Settings2,
  searchCheck: SearchCheck,
  bot: Bot,
  fileCheck: FileCheck2,
  palette: Palette,
  gauge: Gauge,
  rotateCcw: RotateCcw,
  fileCode: FileCode,
  mousePointer: MousePointerClick,
  undo: Undo2,
};

export interface FeatureCapability {
  title: string;
  description: string;
  icon: string;
  badge?: string;
}

export interface WorkflowStep {
  stepNumber: string;
  title: string;
  description: string;
  badge?: string;
}

export interface UseCasePersona {
  title: string;
  subtitle: string;
  icon: string;
  description: string;
  points: string[];
}

export interface RelatedFeature {
  title: string;
  description: string;
  href: string;
  icon: string;
  badge: string;
}

export interface FeatureFaq {
  question: string;
  answer: string;
}

export interface FeaturePageLayoutProps {
  slug: string;
  featureName: string;
  badgeText: string;
  heroHeadline: string;
  heroHeadlineAccent?: string;
  heroSubheadline: string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  trustPoints?: string[];
  explanation: {
    badge: string;
    headline: string;
    description: string;
    highlights: string[];
    callout?: {
      title: string;
      description: string;
    };
  };
  capabilities: FeatureCapability[];
  workflow: {
    badge?: string;
    headline: string;
    description: string;
    steps: WorkflowStep[];
  };
  useCases: {
    badge?: string;
    headline: string;
    description: string;
    personas: UseCasePersona[];
  };
  visualShowcase: {
    badge?: string;
    headline: string;
    description: string;
  };
  relatedFeatures: RelatedFeature[];
  faqs: FeatureFaq[];
  finalCta: {
    badge?: string;
    headline: string;
    description: string;
    primaryCtaText?: string;
    primaryCtaHref?: string;
    secondaryCtaText?: string;
    secondaryCtaHref?: string;
  };
}

export function FeaturePageLayout({
  slug,
  featureName,
  badgeText,
  heroHeadline,
  heroHeadlineAccent,
  heroSubheadline,
  primaryCtaText = "Start Building Free",
  primaryCtaHref = "/#hero-generator",
  secondaryCtaText = "View Pricing Plans",
  secondaryCtaHref = "/pricing",
  trustPoints = [
    "No credit card required",
    "10-day free trial",
    "Export clean Next.js code",
  ],
  explanation,
  capabilities,
  workflow,
  useCases,
  visualShowcase,
  relatedFeatures,
  faqs,
  finalCta,
}: FeaturePageLayoutProps) {
  const router = useRouter();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  const renderIcon = (name: string, className = "w-5 h-5 text-[#A60BFF]") => {
    const IconComponent = ICON_MAP[name] || Sparkles;
    return <IconComponent className={className} />;
  };

  const renderVisualPreview = () => {
    switch (slug) {
      case "ai-website-builder":
        return (
          <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 text-white font-sans text-xs">
            <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-[11px] text-slate-400">
                  codeaxys.com/app/builder
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                  Illustrative Demo Data
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50 text-[10px] font-bold">
                  PRO ENGINE
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                  ● SANDBOX LIVE
                </span>
              </div>
            </div>
            <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                    <span className="flex items-center gap-1.5 text-purple-400">
                      <Sparkles className="w-3.5 h-3.5" /> Prompt Instruction
                    </span>
                    <span className="text-slate-500">Gemini 3.6</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg text-slate-200 border border-slate-800 text-xs leading-relaxed font-mono">
                    &quot;Create a modern luxury car showroom called Velocity Motors with dark aesthetics, hero showcase, vehicle filtering, and an appointment booking modal.&quot;
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400">
                      Generated 4 pages &middot; 12 components
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Regenerate
                    </span>
                  </div>
                </div>
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Generated Structure
                  </span>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/80 text-purple-300 border border-purple-500/20">
                      <span>📁 app/page.tsx</span>
                      <span className="text-[9px] text-emerald-400">Ready</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/40 text-slate-400">
                      <span>📁 components/Hero.tsx</span>
                      <span className="text-[9px] text-emerald-400">Ready</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/40 text-slate-400">
                      <span>📁 components/CarShowcase.tsx</span>
                      <span className="text-[9px] text-emerald-400">Ready</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/40 text-slate-400">
                      <span>📁 components/BookingModal.tsx</span>
                      <span className="text-[9px] text-emerald-400">Ready</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-7 bg-white rounded-xl text-slate-900 p-4 sm:p-6 shadow-inner space-y-5 border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="font-extrabold text-base tracking-tight text-slate-900">
                    VELOCITY MOTORS
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                    <span>Models</span>
                    <span>Showroom</span>
                    <span>Services</span>
                    <span className="px-2.5 py-1 rounded bg-slate-900 text-white text-[10px] font-bold">
                      Book Test Drive
                    </span>
                  </div>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-slate-950 to-slate-900 text-white p-6 space-y-3">
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-400/30">
                    2026 ELECTRIC HYPERCAR
                  </span>
                  <div className="text-xl sm:text-2xl font-black">
                    Performance Redefined.
                  </div>
                  <p className="text-slate-400 text-xs max-w-sm">
                    Experience zero-emission velocity engineered with precision aerodynamics and intelligent cockpit tech.
                  </p>
                  <div className="pt-2 flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-bold text-xs">
                      Configure Now
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium">
                      View Specs
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span>⚡ Illustrative Generation Preview</span>
                  <span className="text-emerald-600 font-bold">
                    ✓ 100% Responsive Next.js 15
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case "visual-editor":
        return (
          <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 text-white font-sans text-xs">
            <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="font-extrabold text-sm text-purple-400">
                  CODEAXYS CANVAS
                </span>
                <div className="h-4 w-px bg-slate-800" />
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <span className="px-2 py-1 rounded bg-purple-600 text-white font-bold text-[10px] flex items-center gap-1">
                    <Laptop className="w-3 h-3" /> Desktop
                  </span>
                  <span className="px-2 py-1 rounded text-slate-400 text-[10px] flex items-center gap-1">
                    <Smartphone className="w-3 h-3" /> Mobile
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                  Illustrative Demo Data
                </span>
                <span className="text-[10px] text-slate-400">
                  All changes saved
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs">
                  Publish Changes
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-[360px]">
              <div className="lg:col-span-8 p-6 bg-slate-950 flex items-center justify-center">
                <div className="w-full max-w-xl bg-white text-slate-900 rounded-xl p-6 shadow-2xl border border-slate-200 relative">
                  <div className="relative border-2 border-purple-500 rounded-lg p-3 bg-purple-50/20">
                    <div className="absolute -top-7 left-2 flex items-center gap-1 bg-purple-700 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-md">
                      <MousePointerClick className="w-3 h-3" />
                      <span>h1.hero-title</span>
                      <span className="text-purple-200">| 48px · Bold</span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                      Transform Your Workflow with Autonomous AI
                    </h1>
                    <p className="text-xs text-slate-600 mt-2">
                      Build websites, optimize search rankings, and launch digital campaigns faster than ever.
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="px-4 py-2 rounded-lg bg-purple-600 text-white font-bold text-xs">
                      Get Started
                    </span>
                    <span className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold">
                      Learn More
                    </span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 bg-slate-900 border-l border-slate-800 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-purple-400" />
                    Visual Inspector
                  </span>
                  <span className="text-[10px] text-purple-400 font-mono">
                    Selected: Title
                  </span>
                </div>
                <div className="bg-slate-950 rounded-lg p-3 border border-purple-500/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-purple-300 font-bold text-[10px]">
                    <Sparkles className="w-3 h-3" />
                    Ask AI to modify selection
                  </div>
                  <div className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-300 font-mono">
                    Make this headline punchier and add gradient styling
                  </div>
                  <span className="block text-center w-full py-1 rounded bg-purple-600 text-white font-bold text-[10px]">
                    Apply AI Modification
                  </span>
                </div>
                <div className="space-y-3 pt-1 text-[11px]">
                  <div className="space-y-1">
                    <div className="text-slate-400 font-medium">Font Family</div>
                    <div className="p-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-sans">
                      Inter / System Sans-Serif
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-slate-400 font-medium">Text Gradient Accent</div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 border border-white/20" />
                      <span className="font-mono text-slate-300 text-[10px]">
                        from-purple-600 to-indigo-600
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "website-migration":
        return (
          <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 text-white font-sans text-xs">
            <div className="bg-slate-950 p-4 border-b border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
                  Codeaxys Website Migration Scanner
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                    Illustrative Demo Data
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                    SCAN COMPLETE
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 flex items-center gap-2 text-slate-300 font-mono text-[11px]">
                  <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>https://legacy-plumbing-service.com</span>
                </div>
                <span className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg text-xs shrink-0 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Re-scan URL
                </span>
              </div>
              <div className="flex items-center gap-4 flex-wrap pt-1 text-[10px] text-slate-400">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> DOM Structure Analyzed
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> 18 Image Assets Extracted
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> Brand Copy Preserved
                </span>
                <span className="flex items-center gap-1 text-purple-400 font-semibold">
                  ✨ AI Modern Redesign Applied
                </span>
              </div>
            </div>
            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-slate-950 rounded-xl border border-rose-900/40 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                    ⚠️ Legacy Original (Dated 2014)
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Lighthouse: 38 (Illustrative Demo)
                  </span>
                </div>
                <div className="bg-slate-900/60 p-4 rounded-lg space-y-3 text-slate-400 text-[11px]">
                  <div className="text-slate-300 font-serif font-bold text-base border-b border-slate-800 pb-2">
                    Apex Plumbing Services Co.
                  </div>
                  <div className="p-2 bg-slate-950 border border-slate-800 text-[10px]">
                    Call 555-0192 today for emergency pipe repairs. Low rates guaranteed. Table layout based design.
                  </div>
                  <div className="text-rose-400 text-[10px] pt-1">
                    ✗ Not mobile friendly &middot; Slow load &middot; 42 plugins
                  </div>
                </div>
              </div>
              <div className="bg-slate-950 rounded-xl border border-purple-500/50 p-4 space-y-3 shadow-lg shadow-purple-950/20">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                    ✨ Codeaxys Next.js 15 Redesign
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">
                    Lighthouse: 98 (Illustrative Demo)
                  </span>
                </div>
                <div className="bg-white rounded-lg p-4 space-y-3 text-slate-900 text-[11px] shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold text-xs text-slate-900">
                      APEX PLUMBING
                    </div>
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px] font-bold">
                      24/7 Available
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="font-black text-sm text-slate-900 leading-tight">
                      Precision Emergency Plumbing When You Need It Most
                    </div>
                    <p className="text-[10px] text-slate-600">
                      Licensed, insured master technicians dispatched in under 45 minutes.
                    </p>
                  </div>
                  <div className="text-emerald-600 text-[10px] font-bold pt-1 border-t border-slate-100 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Fluid Mobile Responsive &middot; Fast Page Load
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "seo-autopilot":
        return (
          <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 text-white font-sans text-xs">
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-extrabold text-sm text-purple-400 flex items-center gap-1.5">
                  <Settings2 className="w-4 h-4 text-purple-400" />
                  SEO AUTOPILOT ENGINE
                </span>
                <div className="h-4 w-px bg-slate-800" />
                <span className="text-[11px] text-slate-400">
                  Target: codeaxys.com
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                  Illustrative Demo Data
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                  ● AGENT ACTIVE
                </span>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Technical Health Score (Illustrative Demo)
                  </div>
                  <div className="text-2xl font-black text-emerald-400">
                    94 <span className="text-xs text-slate-500 font-normal">/ 100</span>
                  </div>
                  <div className="text-[10px] text-emerald-500">
                    ↑ +8 points after latest fixes
                  </div>
                </div>
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Crawl Frequency
                  </div>
                  <div className="text-2xl font-black text-slate-200">
                    Scheduled <span className="text-xs text-slate-500 font-normal">Audits</span>
                  </div>
                  <div className="text-[10px] text-purple-400">
                    Recurring Schedule (Illustrative Demo)
                  </div>
                </div>
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Staged Fixes Ready
                  </div>
                  <div className="text-2xl font-black text-purple-400">
                    2 <span className="text-xs text-slate-500 font-normal">pending</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    1-click approval required
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Optimization Action Queue
                </div>
                <div className="bg-slate-950 rounded-xl p-4 border border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                        HIGH PRIORITY
                      </span>
                      <span className="font-bold text-slate-200 text-xs">
                        Missing OpenGraph &amp; Twitter Cards on 2 Routes
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      AI Agent generated high-converting social sharing preview tags with dynamic titles and fallback images.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-bold text-xs">
                      Approve &amp; Deploy Fix
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "ai-search-visibility":
      default:
        return (
          <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 text-white font-sans text-xs">
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-extrabold text-sm text-purple-400 flex items-center gap-1.5">
                  <SearchCheck className="w-4 h-4 text-purple-400" />
                  AI CITATION &amp; AEO RADAR
                </span>
                <div className="h-4 w-px bg-slate-800" />
                <span className="text-[11px] text-slate-400">
                  Host: codeaxys.com
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                  Illustrative Demo Data
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold">
                  AEO / GEO READY
                </span>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase">
                    AEO Score (Illustrative Demo)
                  </div>
                  <div className="text-2xl font-black text-purple-400">
                    92 <span className="text-xs text-slate-500 font-normal">/ 100</span>
                  </div>
                  <div className="text-[9px] text-emerald-400">
                    Illustrative Readiness Projection
                  </div>
                </div>
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase">
                    llms.txt Status
                  </div>
                  <div className="text-base font-bold text-emerald-400 pt-1">
                    Verified Active
                  </div>
                  <div className="text-[9px] text-slate-400">
                    200 OK &middot; 5.3 KB
                  </div>
                </div>
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase">
                    Schema Entities
                  </div>
                  <div className="text-base font-bold text-slate-200 pt-1">
                    4 Linked Types
                  </div>
                  <div className="text-[9px] text-slate-400">
                    Org, WebSite, App, FAQ
                  </div>
                </div>
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase">
                    AI Search Bots
                  </div>
                  <div className="text-base font-bold text-emerald-400 pt-1">
                    Explicitly Allowed
                  </div>
                  <div className="text-[9px] text-slate-400">
                    robots.txt compliant
                  </div>
                </div>
              </div>
              <div className="space-y-2.5">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Model Citation Readiness Matrix
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-200 text-xs">
                        Perplexity AI
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Direct web extraction &middot; Footnote eligible
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                      HIGH AUTHORITY
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-200 text-xs">
                        ChatGPT Search
                      </div>
                      <div className="text-[10px] text-slate-400">
                        OAI-SearchBot allowed &middot; Structured answers
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                      INDEXED
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-between selection:bg-purple-100 selection:text-purple-900">
      {/* 1. Header Navigation */}
      <Header
        onNewProject={() => router.push("/")}
        onEditPrompt={() => {}}
        onRegenerate={() => {}}
        isGenerating={false}
        hasFiles={false}
        isSidebarOpen={false}
        onToggleSidebar={() => {}}
      />

      <main className="flex-1">
        {/* 2. Breadcrumb Navigation Bar */}
        <nav
          aria-label="Breadcrumb"
          className="border-b border-slate-200/80 bg-slate-50/60 py-2.5 px-4 sm:px-8 text-xs text-slate-500"
        >
          <div className="max-w-6xl mx-auto flex items-center gap-1.5 flex-wrap">
            <Link
              href="/"
              className="hover:text-purple-600 transition-colors font-medium"
            >
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Link
              href="/#features"
              className="hover:text-purple-600 transition-colors font-medium"
            >
              Features
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-900 font-semibold truncate">
              {featureName}
            </span>
          </div>
        </nav>

        {/* 3. Hero Section & Dual CTAs */}
        <section className="relative overflow-hidden pt-12 sm:pt-16 pb-16 sm:pb-20 px-4 sm:px-8 border-b border-slate-200/80 bg-gradient-to-b from-purple-50/40 via-white to-white">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F5EBFF] border border-[#A60BFF]/20 text-[#A60BFF] text-xs font-bold uppercase tracking-wider shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#A60BFF]" />
              <span>{badgeText}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
              {heroHeadline}{" "}
              {heroHeadlineAccent && (
                <span className="bg-gradient-to-r from-[#A60BFF] via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  {heroHeadlineAccent}
                </span>
              )}
            </h1>

            <p className="text-base sm:text-xl text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
              {heroSubheadline}
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                href={primaryCtaHref}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-95 transition-all shadow-md shadow-purple-600/25"
              >
                <span>{primaryCtaText}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href={secondaryCtaHref}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs"
              >
                <span>{secondaryCtaText}</span>
              </Link>
            </div>

            {/* Trust points */}
            {trustPoints && trustPoints.length > 0 && (
              <div className="pt-4 flex items-center justify-center gap-5 flex-wrap text-xs font-semibold text-slate-500">
                {trustPoints.map((point, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#A60BFF]" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 4. Product Explanation Section ("What is [Feature]?") */}
        <section className="py-16 sm:py-20 px-4 sm:px-8 border-b border-slate-200/80 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-7 space-y-5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#A60BFF]">
                  <Zap className="w-3.5 h-3.5" />
                  {explanation.badge}
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                  {explanation.headline}
                </h2>
                <p className="text-base text-slate-600 leading-relaxed font-normal">
                  {explanation.description}
                </p>

                <div className="pt-2 space-y-2.5">
                  {explanation.highlights.map((highlight, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#A60BFF] shrink-0 mt-0.5" />
                      <span className="text-sm font-medium text-slate-700">
                        {highlight}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {explanation.callout && (
                <div className="lg:col-span-5">
                  <div className="rounded-2xl p-6 sm:p-7 bg-gradient-to-br from-purple-50/70 to-indigo-50/50 border border-purple-200/70 space-y-3 shadow-xs">
                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                      ✨
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {explanation.callout.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {explanation.callout.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 5. Key Capabilities (4-6 Feature Cards) */}
        <section className="py-16 sm:py-20 px-4 sm:px-8 border-b border-slate-200/80 bg-slate-50/50">
          <div className="max-w-6xl mx-auto space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#A60BFF]">
                Core Capabilities
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Engineered for Speed, Precision, &amp; Scale
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Explore the tools and automations built directly into the Codeaxys platform.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {capabilities.map((cap, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-6 border border-slate-200/90 hover:border-purple-300 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 space-y-3 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl bg-[#F5EBFF] flex items-center justify-center border border-[#A60BFF]/15 group-hover:scale-105 transition-transform">
                      {renderIcon(cap.icon)}
                    </div>
                    {cap.badge && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
                        {cap.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                    {cap.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                    {cap.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. How It Works (Step-by-step Workflow) */}
        <section className="py-16 sm:py-20 px-4 sm:px-8 border-b border-slate-200/80 bg-white">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#A60BFF]">
                {workflow.badge || "Simple 4-Step Process"}
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {workflow.headline}
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                {workflow.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
              {workflow.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-purple-300 relative space-y-3 shadow-2xs hover:shadow-xs transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-black text-purple-200/80 group-hover:text-purple-300 font-mono">
                      {step.stepNumber}
                    </span>
                    {step.badge && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {step.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Visual Showcase / Interactive Preview */}
        <section className="py-16 sm:py-20 px-4 sm:px-8 border-b border-slate-200/80 bg-slate-50/50">
          <div className="max-w-6xl mx-auto space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#A60BFF]">
                {visualShowcase.badge || "Product Interface"}
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {visualShowcase.headline}
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                {visualShowcase.description}
              </p>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/80 border border-slate-300 text-slate-700 text-[11px] font-semibold tracking-wide">
                  Illustrative Demo Data — Mockup interface for feature demonstration purposes.
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-3 sm:p-6 shadow-xl shadow-slate-200/40 overflow-hidden">
              {renderVisualPreview()}
            </div>
          </div>
        </section>

        {/* 8. Who It's For / Use Cases */}
        <section className="py-16 sm:py-20 px-4 sm:px-8 border-b border-slate-200/80 bg-white">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#A60BFF]">
                {useCases.badge || "Target Solutions"}
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {useCases.headline}
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                {useCases.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {useCases.personas.map((persona, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 hover:border-purple-300 shadow-2xs hover:shadow-md transition-all space-y-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200/60 flex items-center justify-center">
                    {renderIcon(persona.icon, "w-6 h-6 text-purple-600")}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900">
                      {persona.title}
                    </h3>
                    <p className="text-xs font-semibold text-purple-600">
                      {persona.subtitle}
                    </p>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {persona.description}
                  </p>
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    {persona.points.map((pt, pIdx) => (
                      <div key={pIdx} className="flex items-center gap-2 text-xs font-medium text-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#A60BFF] shrink-0" />
                        <span>{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 9. Related Features (Internal Cross-Linking) */}
        <section className="py-16 sm:py-20 px-4 sm:px-8 border-b border-slate-200/80 bg-slate-50/50">
          <div className="max-w-6xl mx-auto space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#A60BFF]">
                Connected Ecosystem
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Explore More Platform Capabilities
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Codeaxys seamlessly combines creation, visual refinement, migration, and autonomous SEO.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedFeatures.map((rel, idx) => (
                <Link
                  key={idx}
                  href={rel.href}
                  className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-purple-300 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-[#F5EBFF] flex items-center justify-center border border-[#A60BFF]/15 group-hover:scale-105 transition-transform">
                        {renderIcon(rel.icon)}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
                        {rel.badge}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                      {rel.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                      {rel.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-purple-600 group-hover:translate-x-0.5 transition-transform">
                    <span>Explore feature</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 10. Frequently Asked Questions (FAQ Accordion with Schema.org match) */}
        <section className="py-16 sm:py-20 px-4 sm:px-8 border-b border-slate-200/80 bg-white">
          <div className="max-w-3xl mx-auto space-y-10">
            <div className="text-center space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#A60BFF]">
                Got Questions?
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Frequently Asked Questions
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                Everything you need to know about {featureName}.
              </p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-2xl overflow-hidden transition-colors bg-white hover:border-slate-300"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(idx)}
                      className="w-full text-left px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 cursor-pointer hover:text-purple-700 transition-colors"
                      aria-expanded={isOpen}
                    >
                      <span>{faq.question}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-purple-600" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 sm:px-6 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 font-normal">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 11. Final Conversion CTA */}
        <section className="py-16 sm:py-24 px-4 sm:px-8 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white relative overflow-hidden">
          <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
            {finalCta.badge && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                {finalCta.badge}
              </span>
            )}
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              {finalCta.headline}
            </h2>
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto font-normal">
              {finalCta.description}
            </p>
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={finalCta.primaryCtaHref || "/#hero-generator"}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-slate-950 bg-white hover:bg-slate-100 active:scale-95 transition-all shadow-lg shadow-white/10"
              >
                <span>{finalCta.primaryCtaText || "Start Building Free"}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={finalCta.secondaryCtaHref || "/pricing"}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-white border border-slate-700 hover:bg-slate-800/80 transition-all"
              >
                <span>{finalCta.secondaryCtaText || "View Pricing Plans"}</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* 12. Footer */}
      <Footer />
    </div>
  );
}
