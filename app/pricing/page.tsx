"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLANS, PlanConfig } from "@/lib/constants";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MockCheckoutModal } from "@/components/MockCheckoutModal";
import {
  Wand2,
  Palette,
  Search,
  Globe,
  Zap,
  CheckCircle2,
  Sparkles,
  Layers,
  FileCode2,
  BarChart3,
  Sliders,
  ShieldCheck,
  ChevronDown,
  HelpCircle,
} from "lucide-react";

const FAQ_ITEMS = [
  {
    question: "What is Codeaxys AI Website Builder?",
    answer:
      "Codeaxys is an AI powered website builder that helps you create, edit, and manage professional websites using simple instructions without needing to write code.",
  },
  {
    question: "Do I need coding knowledge to use Codeaxys?",
    answer:
      "No. You can create and customize your website using AI and visual editing tools without technical coding knowledge.",
  },
  {
    question: "What is included in every plan?",
    answer:
      "Every plan includes AI website generation, website editing, unlimited page creation, responsive design tools, global styling controls, and the complete SEO Intelligence Suite.",
  },
  {
    question: "How many websites can I create?",
    answer:
      "The number of websites depends on your plan. Starter includes 1 website, Pro includes 3, Business includes 6, and Agency includes 15 websites.",
  },
  {
    question: "Can I create multiple pages for my website?",
    answer: "Yes. All plans include unlimited page creation.",
  },
  {
    question: "Can I connect my own domain?",
    answer: "Yes. You can connect and publish your website using your own custom domain.",
  },
  {
    question: "Is SEO included in all plans?",
    answer: "Yes. The complete SEO Intelligence Suite is included with all plans.",
  },
  {
    question: "Can I edit my website after it is generated?",
    answer:
      "Yes. You can continue editing, refining, and customizing your website after AI generation.",
  },
  {
    question: "Can I upgrade my plan later?",
    answer:
      "Yes. You can upgrade your subscription as your website and business requirements grow.",
  },
  {
    question: "What are AI Credits used for?",
    answer:
      "AI Credits are used for AI powered operations such as website generation and other AI assisted actions within the platform.",
  },
  {
    question: "Can I use Codeaxys for business websites?",
    answer:
      "Yes. Codeaxys can be used to create websites for businesses, agencies, startups, ecommerce businesses, professionals, and many other industries.",
  },
  {
    question: "Do I need separate tools for SEO?",
    answer:
      "No. Codeaxys includes its SEO Intelligence Suite directly within the platform, so you can manage your website SEO from the same system.",
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string>("free");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  useEffect(() => {
    fetchUserData();
    if (typeof window !== "undefined" && window.location.hash === "#all-plans-include") {
      setTimeout(() => {
        const el = document.getElementById("all-plans-include");
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }, 300);
    }
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/billing/subscription");
      if (res.ok) {
        const data = await res.json();
        if (data.usage?.plan?.id) {
          setCurrentPlanId(data.usage.plan.id);
        }
        setUser(true);
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanClick = (planId: string) => {
    if (planId === currentPlanId) return;

    if (!user) {
      router.push("/login");
      return;
    }

    setSelectedPlanId(planId);
    setIsCheckoutOpen(true);
  };

  const handleCheckoutSuccess = () => {
    fetchUserData();
    router.push("/dashboard/billing");
  };

  // 4 Primary Plans focused on Key Differences
  const displayPlans = [PLANS.starter, PLANS.pro, PLANS.business, PLANS.agency].filter(Boolean);

  // All Plans Include Feature Categories
  const allPlansFeatures = [
    {
      title: "AI Website Builder",
      icon: Wand2,
      description: "Conversational website creation, instant code generation, and intelligent refinement.",
      badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
      iconColor: "text-purple-600 bg-purple-50 border-purple-200",
      features: [
        "AI Website Generation",
        "AI Website Editing",
        "AI Website Refinement",
        "Codeaxys AI Agent",
        "Conversational Website Planning",
        "AI Generated Content",
        "Responsive Website Generation",
        "Unlimited Page Creation",
      ],
    },
    {
      title: "Website Design & Editing",
      icon: Palette,
      description: "Visual editing canvas, custom section building, and global style controls.",
      badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
      iconColor: "text-blue-600 bg-blue-50 border-blue-200",
      features: [
        "Website Sections",
        "Page Management",
        "Global Colors",
        "Global Typography",
        "Buttons & Design Settings",
        "Responsive Editing",
        "Media Management",
        "Logo Support",
        "Custom Sections",
        "Website Preview",
      ],
    },
    {
      title: "Full SEO Intelligence Suite",
      icon: Search,
      description: "Comprehensive end-to-end SEO analytics, automated optimization, and keyword intelligence.",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
      iconColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
      featured: true,
      features: [
        "SEO Command Center",
        "SEO Overview",
        "Technical Crawl",
        "Content Studio",
        "Competitor Intelligence",
        "Content Gap Analysis",
        "AEO / AI Search",
        "Topical Authority",
        "Opportunity Engine",
        "SEO Autopilot",
        "Performance",
        "Monitoring",
        "Organic SEO",
        "Technical SEO",
        "Internal Links",
        "Local SEO",
        "Content & Blog",
        "Pages",
        "Keywords / Rankings",
        "Google Search Console",
        "SEO AI Agent",
        "AI SEO Fixes",
        "Unified SEO Health",
      ],
    },
    {
      title: "Website Management",
      icon: Globe,
      description: "Custom domain publishing, security, DNS configuration, and clean code export.",
      badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
      iconColor: "text-indigo-600 bg-indigo-50 border-indigo-200",
      features: [
        "Custom Domain Connection",
        "Website Publishing",
        "Website Unpublishing",
        "Website Dashboard",
        "Website Settings",
        "SEO Settings",
        "Website Management",
        "HTML Export",
      ],
    },
    {
      title: "Content & Performance",
      icon: Zap,
      description: "Automated blogging, multi-device viewport optimization, and performance tracking.",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
      iconColor: "text-amber-600 bg-amber-50 border-amber-200",
      features: [
        "AI Content Creation",
        "Blog Management",
        "SEO Content Optimization",
        "Content Refresh",
        "Mobile Responsive Websites",
        "Tablet Responsive Websites",
        "Desktop Responsive Websites",
        "Performance Insights",
        "Website Health Insights",
        "SEO Recommendations",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Homepage Header Navigation */}
      <Header
        onNewProject={() => router.push("/")}
        onEditPrompt={() => {}}
        onRegenerate={() => {}}
        isGenerating={false}
        hasFiles={false}
        isSidebarOpen={false}
        onToggleSidebar={() => {}}
      />

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full">
        {/* Test Mode Banner */}
        <div className="max-w-3xl mx-auto mb-10 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center gap-3 text-amber-900 text-xs font-semibold text-center shadow-xs">
          <span className="text-base">🧪</span>
          <span>
            <strong>TEST BILLING MODE ACTIVE:</strong> No real payments are processed. Upgrades use instant mock transaction simulation.
          </span>
        </div>

        {/* Hero Headline */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <span className="px-3.5 py-1 bg-purple-100 text-purple-700 border border-purple-200/80 rounded-full text-xs font-bold uppercase tracking-wider inline-block">
            Simple, Transparent Pricing
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Build Stunning AI Websites at Any Scale
          </h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-2xl mx-auto font-normal">
            Choose the plan that fits your business needs. Every plan includes full access to our AI Website Builder and Full SEO Intelligence Suite.
          </p>
        </div>

        {/* 1. PRICING PLANS GRID (4 Columns: Starter, Pro, Business, Agency) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20 items-stretch">
          {displayPlans.map((plan) => {
            const isCurrent = currentPlanId === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative bg-white border rounded-2xl p-6 flex flex-col justify-between transition-all ${
                  plan.popular
                    ? "border-purple-500 shadow-xl ring-2 ring-purple-500/20"
                    : "border-slate-200 shadow-sm hover:shadow-md"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-full shadow-sm">
                    Most Popular
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">{plan.name}</h3>

                  <div className="flex items-baseline gap-1 mt-3 mb-6">
                    <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                      ₹{plan.price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">/ month</span>
                  </div>

                  {/* Key Plan Differences */}
                  <div className="space-y-2.5 border-t border-slate-100 pt-5 mb-8">
                    <div className="flex items-center justify-between text-xs py-1.5 px-3 bg-purple-50/70 border border-purple-100 rounded-xl">
                      <span className="font-semibold text-slate-600">Websites</span>
                      <strong className="font-extrabold text-purple-700">{plan.maxWebsites} {plan.maxWebsites === 1 ? "Website" : "Websites"}</strong>
                    </div>

                    <div className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="font-semibold text-slate-600">AI Credits / Month</span>
                      <strong className="font-extrabold text-slate-900">{plan.monthlyCredits.toLocaleString()} Credits</strong>
                    </div>

                    <div className="flex items-center justify-between text-xs py-1.5 px-3 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                      <span className="font-semibold text-slate-600">Storage</span>
                      <strong className="font-extrabold text-emerald-700">{plan.storageLimitFormatted}</strong>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handlePlanClick(plan.id)}
                  disabled={isCurrent}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all shadow-xs ${
                    isCurrent
                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      : plan.popular
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-purple-200 active:scale-95"
                      : "bg-slate-900 hover:bg-slate-800 text-white active:scale-95"
                  }`}
                >
                  {isCurrent ? "Current Active Plan" : `Upgrade to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* 2. ALL PLANS INCLUDE SECTION (Seamless Layout - Outer Container Box Removed) */}
        <section id="all-plans-include" className="relative space-y-12 py-8 w-full">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3 relative z-10">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-100/80 border border-purple-200 text-purple-900 text-xs font-bold uppercase tracking-wider shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Complete Core Platform Capabilities
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
              All Plans Include
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto font-normal">
              No hidden feature lockouts. Every subscription tier grants complete access to our AI Website Builder, visual editing suite, full SEO intelligence system, and management tools.
            </p>
          </div>

          <div className="space-y-8 relative z-10 w-full">
            {/* HERO FEATURE BLOCK: Full SEO Intelligence Suite (Dark Luxury Banner) */}
            <div className="bg-gradient-to-r from-slate-950 via-purple-950 to-slate-950 text-white rounded-3xl p-8 sm:p-10 border border-purple-500/40 shadow-2xl relative overflow-hidden w-full">
              {/* Subtle Glowing Radial Light Glow */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-800/60 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-600/30 border border-purple-400/40 text-purple-300 flex items-center justify-center shrink-0 shadow-lg shadow-purple-900/40">
                      <Search className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                          Full SEO Intelligence Suite
                        </h3>
                        <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                          Included in All Plans
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 font-medium">
                        Comprehensive end-to-end SEO analytics, AI search optimization, automated crawling, and keyword intelligence.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 23 Features Organized into 4 Sub-Groups */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                  {/* Group 1 */}
                  <div className="space-y-3 bg-purple-950/50 p-4 rounded-2xl border border-purple-800/60 w-full">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Command & Analytics
                    </h4>
                    <ul className="space-y-2 text-xs font-medium text-slate-200">
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> SEO Command Center</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> SEO Overview</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Technical Crawl</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Content Studio</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Competitor Intelligence</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Content Gap Analysis</li>
                    </ul>
                  </div>

                  {/* Group 2 */}
                  <div className="space-y-3 bg-purple-950/50 p-4 rounded-2xl border border-purple-800/60 w-full">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-indigo-400" /> AI & Search Engine
                    </h4>
                    <ul className="space-y-2 text-xs font-medium text-slate-200">
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> AEO / AI Search</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Topical Authority</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Opportunity Engine</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> SEO Autopilot</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Organic SEO</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Technical SEO</li>
                    </ul>
                  </div>

                  {/* Group 3 */}
                  <div className="space-y-3 bg-purple-950/50 p-4 rounded-2xl border border-purple-800/60 w-full">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-cyan-400" /> Structure & Integrations
                    </h4>
                    <ul className="space-y-2 text-xs font-medium text-slate-200">
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Internal Links</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Local SEO</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Content & Blog</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Pages Management</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Keywords / Rankings</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Google Search Console</li>
                    </ul>
                  </div>

                  {/* Group 4 */}
                  <div className="space-y-3 bg-purple-950/50 p-4 rounded-2xl border border-purple-800/60 w-full">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> AI Agent & Health
                    </h4>
                    <ul className="space-y-2 text-xs font-medium text-slate-200">
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> SEO AI Agent</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> AI SEO Fixes</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Unified SEO Health</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Real-time Performance</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Continuous Monitoring</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* BENTO GRID: 4 Core Platform Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              {/* Card 1: AI Website Builder */}
              <div className="bg-white border border-purple-200/80 hover:border-purple-300 shadow-md hover:shadow-lg transition-all duration-300 rounded-3xl p-6 sm:p-8 flex flex-col justify-between group w-full h-full">
                <div className="space-y-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-purple-600/25">
                        <Wand2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900">AI Website Builder</h3>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                          Conversational Engine
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Conversational website planning, instant code generation, and intelligent prompt refinement.
                  </p>

                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-700">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" /> AI Website Generation</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" /> AI Website Editing</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" /> AI Website Refinement</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" /> Codeaxys AI Agent</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" /> Conversational Planning</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" /> AI Generated Content</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" /> Responsive Generation</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" /> Unlimited Page Creation</li>
                  </ul>
                </div>
              </div>

              {/* Card 2: Website Design & Editing */}
              <div className="bg-white border border-blue-200/80 hover:border-blue-300 shadow-md hover:shadow-lg transition-all duration-300 rounded-3xl p-6 sm:p-8 flex flex-col justify-between group w-full h-full">
                <div className="space-y-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/25">
                        <Palette className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900">Website Design & Editing</h3>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                          Visual Design System
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Visual editing canvas, custom section building, logo support, and global typography controls.
                  </p>

                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-700">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" /> Website Sections</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" /> Page Management</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" /> Global Colors</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" /> Global Typography</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" /> Buttons & Design Settings</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" /> Responsive Editing</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" /> Media Management</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" /> Logo Support</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" /> Custom Sections</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" /> Website Preview</li>
                  </ul>
                </div>
              </div>

              {/* Card 3: Website Management */}
              <div className="bg-white border border-indigo-200/80 hover:border-indigo-300 shadow-md hover:shadow-lg transition-all duration-300 rounded-3xl p-6 sm:p-8 flex flex-col justify-between group w-full h-full">
                <div className="space-y-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/25">
                        <Globe className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900">Website Management</h3>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                          Publishing & Hosting
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Custom domain publishing, security, DNS configuration, and clean HTML code export.
                  </p>

                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-700">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" /> Custom Domain Connection</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" /> Website Publishing</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" /> Website Unpublishing</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" /> Website Dashboard</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" /> Website Settings</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" /> SEO Settings</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" /> Website Management</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" /> HTML Export</li>
                  </ul>
                </div>
              </div>

              {/* Card 4: Content & Performance */}
              <div className="bg-white border border-amber-200/80 hover:border-amber-300 shadow-md hover:shadow-lg transition-all duration-300 rounded-3xl p-6 sm:p-8 flex flex-col justify-between group w-full h-full">
                <div className="space-y-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/25">
                        <Zap className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900">Content & Performance</h3>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                          Automated Content Engine
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Automated blogging, multi-device viewport optimization, and performance monitoring.
                  </p>

                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-700">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" /> AI Content Creation</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" /> Blog Management</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" /> SEO Content Optimization</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" /> Content Refresh</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" /> Mobile Responsive Views</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" /> Tablet Responsive Views</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" /> Desktop Responsive Views</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" /> Performance Insights</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" /> Website Health Insights</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" /> SEO Recommendations</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. FREQUENTLY ASKED QUESTIONS SECTION */}
        <section className="mt-24 pt-16 border-t border-slate-200/80 w-full max-w-4xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-3">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold uppercase tracking-wider shadow-2xs">
              <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
              Got Questions? We&apos;ve Got Answers
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto font-normal">
              Everything you need to know about Codeaxys plans, website builder features, custom domains, and SEO intelligence.
            </p>
          </div>

          {/* Accordion list */}
          <div className="space-y-4">
            {FAQ_ITEMS.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className={`bg-white border rounded-2xl transition-all duration-200 overflow-hidden ${
                    isOpen
                      ? "border-purple-300 shadow-md ring-1 ring-purple-100"
                      : "border-slate-200/80 shadow-xs hover:border-slate-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left gap-4 font-bold text-slate-900 text-base sm:text-lg focus:outline-none group cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-purple-50 text-purple-700 text-xs font-black flex items-center justify-center shrink-0 border border-purple-200">
                        {index + 1}
                      </span>
                      <span>{faq.question}</span>
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-purple-600 shrink-0 transition-transform duration-300 ${
                        isOpen ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </button>

                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-6 pb-6 pt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-normal border-t border-slate-100/80">
                        {faq.answer}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Homepage Footer */}
      <Footer />

      {/* Mock Checkout Modal */}
      {selectedPlanId && (
        <MockCheckoutModal
          planId={selectedPlanId}
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </div>
  );
}
