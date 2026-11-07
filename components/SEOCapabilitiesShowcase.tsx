"use client";

import React from "react";
import Link from "next/link";
import {
  Gauge,
  Sliders,
  Bot,
  BookOpen,
  Target,
  Cpu,
  CheckCircle2,
  RotateCw,
  ArrowRight,
} from "lucide-react";

interface SEOFeature {
  name: string;
  description: string;
}

interface SEOCategory {
  id: string;
  title: string;
  badge: string;
  summary: string;
  icon: React.ElementType;
  features: SEOFeature[];
  hasWorkflow?: boolean;
  categoryLink?: {
    text: string;
    href: string;
  };
}

const SEO_CATEGORIES: SEOCategory[] = [
  {
    id: "command-center-analytics",
    title: "SEO Command Center & Analytics",
    badge: "Command & Analytics",
    summary:
      "Unified executive health monitoring, real-time performance tracking, and client-ready white-label reporting.",
    icon: Gauge,
    features: [
      {
        name: "SEO Command Center",
        description:
          "Centralized operational hub tracking overall SEO health score, active engine status, and priority actions.",
      },
      {
        name: "SEO Overview",
        description:
          "High-level visibility summary covering site indexation status, search presence, and domain-wide vitals.",
      },
      {
        name: "Performance",
        description:
          "In-depth organic search traffic metrics, impression trends, average click-through rates, and ranking trajectories.",
      },
      {
        name: "Monitoring",
        description:
          "Continuous 24/7 site health checks with immediate alerts for indexation drops, broken links, and ranking shifts.",
      },
      {
        name: "Reports & White Label",
        description:
          "Customizable branded PDF reports, automated scheduling, and client-ready white-label reporting for agencies.",
      },
    ],
  },
  {
    id: "technical-organic-seo",
    title: "Technical & Organic SEO",
    badge: "Technical & On-Page",
    summary:
      "Deep automated crawl diagnostics, structured schema, on-page SEO signals, internal links, and local search visibility.",
    icon: Sliders,
    features: [
      {
        name: "Technical Crawl",
        description:
          "Automated site crawler identifying 404 broken links, redirect loops, crawl errors, and asset load bottlenecks.",
      },
      {
        name: "Technical SEO",
        description:
          "Automated schema markup, dynamic XML sitemaps, robots.txt management, and Core Web Vitals optimization.",
      },
      {
        name: "Organic SEO",
        description:
          "Page-level title tags, meta descriptions, semantic heading hierarchies, and Open Graph social sharing tags.",
      },
      {
        name: "Internal Links",
        description:
          "Internal link graph analysis, anchor text optimization, and orphan page detection to strengthen site structure.",
      },
      {
        name: "Local SEO",
        description:
          "Google Business Profile sync, local schema generation, and localized NAP consistency for regional discovery.",
      },
      {
        name: "Pages",
        description:
          "Page-by-page indexation checks, crawl health metrics, and granular on-page optimization scorecards.",
      },
      {
        name: "SEO Settings",
        description:
          "Global search engine verification, canonicalization rules, social preview cards, and indexing directives.",
      },
    ],
  },
  {
    id: "ai-search-visibility",
    title: "AI Search Visibility",
    badge: "AEO & Generative Search",
    summary:
      "Answer Engine Optimization (AEO) and conversational search tracking across ChatGPT, Perplexity, Gemini, and Claude.",
    icon: Bot,
    categoryLink: {
      text: "Explore AI Search Visibility",
      href: "/features/ai-search-visibility",
    },
    features: [
      {
        name: "AEO / AI Search",
        description:
          "Answer Engine Optimization engineering your website content for direct citations in generative AI answer engines.",
      },
      {
        name: "AI Visibility",
        description:
          "Tracking brand citations, source mentions, and authority scores across leading AI search models.",
      },
      {
        name: "Keywords / SERP & AI",
        description:
          "Unified keyword intelligence tracking positions across traditional Google SERPs and generative AI responses.",
      },
    ],
  },
  {
    id: "content-topical-authority",
    title: "Content & Topical Authority",
    badge: "Content Architecture",
    summary:
      "Establish industry topical leadership with semantic topic maps, AI assisted drafting, and competitive gap discovery.",
    icon: BookOpen,
    features: [
      {
        name: "Content Studio",
        description:
          "AI-powered content writer and editor with real-time SEO scoring, entity insertion, and readability checks.",
      },
      {
        name: "Content & Blog",
        description:
          "Integrated CMS blog engine with automated schema generation, structured author tags, and instant SEO publishing.",
      },
      {
        name: "Content Gaps",
        description:
          "Competitive gap discovery uncovering missing high-value topics and queries where rival websites outrank you.",
      },
      {
        name: "Topical Authority",
        description:
          "Pillar-cluster topic mapping and entity relevance modeling to systematically build domain authority.",
      },
    ],
  },
  {
    id: "competitor-opportunity-intelligence",
    title: "Competitor & Opportunity Intelligence",
    badge: "Market Intelligence",
    summary:
      "Real-time competitor benchmarking, keyword overlap analysis, and automated algorithmic ranking opportunities.",
    icon: Target,
    features: [
      {
        name: "Competitors",
        description:
          "Head-to-head domain benchmarking, competitor keyword overlap tracking, and search visibility comparisons.",
      },
      {
        name: "Opportunity Engine",
        description:
          "Algorithmic recommendation engine identifying instant high-impact ranking quick-wins and priority optimizations.",
      },
    ],
  },
  {
    id: "seo-autopilot",
    title: "SEO Autopilot",
    badge: "Autonomous Optimization",
    summary:
      "Autonomous background optimization engine with safe staging, recurring health scans, and guided remediation.",
    icon: Cpu,
    categoryLink: {
      text: "Explore SEO Autopilot",
      href: "/features/seo-autopilot",
    },
    features: [
      {
        name: "SEO Autopilot",
        description:
          "Autonomous engine running scheduled health checks, staging verified fixes, and continuously maintaining search health.",
      },
      {
        name: "Optimization Workflow",
        description:
          "Multi-stage optimization lifecycle: Automated Site Audit → AI Recommendation → Staging Review → 1-Click Auto-Fix.",
      },
    ],
    hasWorkflow: true,
  },
];

export function SEOCapabilitiesShowcase() {
  return (
    <div className="space-y-8">
      {/* Category Section Header */}
      <div className="text-center space-y-2 max-w-3xl mx-auto">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 uppercase tracking-widest bg-purple-100/80 px-3.5 py-1 rounded-full border border-purple-200/80 shadow-2xs">
          BUILT-IN SEO TOOLS
        </span>
        <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Everything Inside Your SEO Toolkit
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto">
          Explore the tools that help you analyze, optimize, and grow your search visibility.
        </p>
      </div>

      {/* Six-Category Grid: Clean White Cards with Codeaxys Purple & Lavender Accents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SEO_CATEGORIES.map((category) => {
          const IconComponent = category.icon;

          return (
            <div
              key={category.id}
              className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm hover:border-purple-300 hover:shadow-md transition-all duration-300 p-6 sm:p-7 flex flex-col justify-between group"
            >
              <div className="space-y-4">
                {/* Category Header Row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F5EBFF] border border-[#A60BFF]/20 flex items-center justify-center text-[#A60BFF] shrink-0">
                    <IconComponent className="w-5 h-5 text-[#A60BFF]" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider text-purple-700 uppercase bg-[#F5EBFF] border border-[#A60BFF]/20 shrink-0">
                    {category.badge}
                  </span>
                </div>

                {/* Title & Category Summary */}
                <div className="space-y-1.5">
                  <h4 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight group-hover:text-purple-700 transition-colors">
                    {category.title}
                  </h4>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {category.summary}
                  </p>
                </div>

                {/* Complete Feature List (Fully Visible, Never Hidden) */}
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  {category.features.map((feature) => (
                    <div
                      key={feature.name}
                      className="flex items-start gap-2.5 group/feature"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#A60BFF] shrink-0 mt-0.5" />
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-bold text-slate-900 group-hover/feature:text-purple-700 transition-colors">
                          {feature.name}
                        </div>
                        <div className="text-[11px] text-slate-600 font-normal leading-relaxed">
                          {feature.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optimization Workflow Visual Strip for SEO Autopilot */}
              {category.hasWorkflow && (
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                  <div className="text-[10px] font-mono font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                    <RotateCw className="w-3 h-3 text-[#A60BFF]" /> Optimization Workflow
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                      <span className="text-[9px] font-bold text-slate-500 block font-mono">1. AUDIT</span>
                      <span className="text-[10px] font-semibold text-slate-800 block truncate">Site Scan</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                      <span className="text-[9px] font-bold text-purple-600 block font-mono">2. AI PLAN</span>
                      <span className="text-[10px] font-semibold text-slate-800 block truncate">Recommend</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                      <span className="text-[9px] font-bold text-indigo-600 block font-mono">3. STAGE</span>
                      <span className="text-[10px] font-semibold text-slate-800 block truncate">Review</span>
                    </div>
                    <div className="bg-[#F5EBFF] p-2 rounded-xl border border-[#A60BFF]/30">
                      <span className="text-[9px] font-bold text-[#A60BFF] block font-mono">4. AUTO-FIX</span>
                      <span className="text-[10px] font-bold text-purple-900 block truncate">Execute</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Contextual Feature Page Link */}
              {category.categoryLink && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                  <Link
                    href={category.categoryLink.href}
                    className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                  >
                    <span>{category.categoryLink.text}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
