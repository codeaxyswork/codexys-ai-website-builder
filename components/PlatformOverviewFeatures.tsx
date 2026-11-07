"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRightLeft,
  Palette,
  SearchCheck,
  CalendarDays,
  Settings2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

interface FeatureCardItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  badge: string;
  href?: string;
}

const FEATURE_CARDS: FeatureCardItem[] = [
  {
    id: "ai-generation",
    title: "AI Website Generation",
    description: "Create professional, responsive websites using AI.",
    icon: Sparkles,
    badge: "Prompt-to-Code · Instant Sandbox",
    href: "/features/ai-website-builder",
  },
  {
    id: "website-migration",
    title: "Website Migration",
    description: "Migrate existing website content and media.",
    icon: ArrowRightLeft,
    badge: "URL Importer · Preserves Assets",
    href: "/features/website-migration",
  },
  {
    id: "migration-redesign",
    title: "Migration + Redesign",
    description: "Migrate and transform existing websites with modern, responsive designs.",
    icon: Palette,
    badge: "AI Re-styling · Before/After Snapshots",
    href: "/features/website-migration",
  },
  {
    id: "seo-intelligence",
    title: "SEO Intelligence",
    description: "Discover SEO issues, keyword opportunities, competitor gaps, and AI search visibility insights.",
    icon: SearchCheck,
    badge: "AEO/GEO Radar · Technical Audits",
    href: "/features/ai-search-visibility",
  },
  {
    id: "social-media",
    title: "Social Media Management",
    description: "Create content, plan campaigns, schedule posts, and analyze performance.",
    icon: CalendarDays,
    badge: "Content Calendar · Multi-Channel",
  },
  {
    id: "seo-autopilot",
    title: "SEO Autopilot",
    description: "Discover SEO opportunities, review prioritized recommendations, and manage proposed optimization fixes.",
    icon: Settings2,
    badge: "Autonomous Fixes · 1-Click Approval",
    href: "/features/seo-autopilot",
  },
];

export function PlatformOverviewFeatures() {
  return (
    <section
      id="platform-overview"
      className="py-20 sm:py-24 px-6 sm:px-12 bg-white border-b border-slate-200/80 relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-start">
          {/* Left Column: Sticky Section Headline & Description */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F5EBFF] border border-[#A60BFF]/20 text-[#A60BFF] text-xs font-bold uppercase tracking-wider shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-[#A60BFF]" />
                Platform Capabilities
              </span>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
                One Platform.{" "}
                <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-[#A60BFF] via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  Everything to Build, Manage &amp; Grow.
                </span>
              </h2>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
                Build websites, migrate and redesign existing sites, improve search visibility, and manage social media from one powerful platform.
              </p>
            </div>

            {/* Core Pillars Bullet Points */}
            <div className="pt-2 space-y-3 border-t border-slate-100 text-xs sm:text-sm font-semibold text-slate-700">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#A60BFF] shrink-0" />
                <span>Full-lifecycle AI website creation &amp; visual editing</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#A60BFF] shrink-0" />
                <span>Smart migration with automated modern redesign</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#A60BFF] shrink-0" />
                <span>Autonomous SEO tracking &amp; marketing automation</span>
              </div>
            </div>
          </div>

          {/* Right Column: 2-Column x 3-Row Feature Grid */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURE_CARDS.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.id}
                  id={`feature-card-${card.id}`}
                  className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 hover:border-[#A60BFF]/40 shadow-xs hover:shadow-xl hover:shadow-purple-900/5 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group space-y-4"
                >
                  <div className="space-y-3">
                    {/* Icon container: lavender background with Codeaxys purple accent */}
                    <div className="w-12 h-12 rounded-2xl bg-[#F5EBFF] flex items-center justify-center shrink-0 border border-[#A60BFF]/15 group-hover:scale-105 transition-transform duration-200">
                      <Icon className="w-5 h-5 text-[#A60BFF]" strokeWidth={2} />
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-lg font-extrabold text-slate-900 tracking-tight leading-snug group-hover:text-[#6938ef] transition-colors">
                        {card.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                        {card.description}
                      </p>
                    </div>
                  </div>

                  {/* Visual Product Capability Pill & Link */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#A60BFF] inline-block shrink-0" />
                      <span className="truncate">{card.badge}</span>
                    </div>
                    {card.href && (
                      <Link
                        href={card.href}
                        className="text-purple-600 hover:text-purple-700 font-bold flex items-center gap-1 shrink-0 group-hover:translate-x-0.5 transition-transform"
                      >
                        <span>Learn more</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
