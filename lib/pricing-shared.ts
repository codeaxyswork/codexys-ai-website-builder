import React from "react";
import { ADDON_CATALOG } from "@/lib/addons/catalog";
import {
  Sparkles,
  Sliders,
  Layout,
  Smartphone,
  ShieldCheck,
  ArrowRightLeft,
  Palette,
  Mail,
  FileText,
  Link2,
  FileCode,
  Activity,
  Code2,
  Target,
  Globe,
  Bot,
  PenTool,
  Hash,
  Compass,
  Calendar,
  Clock,
  Send,
  BarChart2,
  Share2,
  Search,
  SearchCheck,
  ChartNoAxesCombined,
  Settings2,
  FilePen,
  CalendarDays,
  ChartPie,
} from "lucide-react";

// Existing approved add-on pricing from centralized add-on catalog
export const ADDON_PRICE_MONTHLY =
  ADDON_CATALOG.digital_marketing_meta_suite?.pricing?.monthlyPriceUnapproved || 349;
export const ADDON_PRICE_ANNUAL =
  ADDON_CATALOG.digital_marketing_meta_suite?.pricing?.annualPriceUnapproved || 3490;

// Approved FAQ items preserved
export const FAQ_ITEMS = [
  {
    question: "What is Codeaxys AI Website Builder?",
    answer:
      "Codeaxys is an AI-powered website builder that helps you create, edit, and manage professional websites using simple conversational instructions without needing to write code.",
  },
  {
    question: "Do I need coding knowledge to use Codeaxys?",
    answer:
      "No. You can create and customize your website using AI prompts and our visual drag-and-drop editing canvas without any technical coding knowledge.",
  },
  {
    question: "What is included in every plan?",
    answer:
      "Every plan includes AI website generation, visual section editing, unlimited page creation, responsive design tools, global styling controls, clean HTML export, free SSL certificates, and essential Basic SEO features.",
  },
  {
    question: "How many websites can I create?",
    answer:
      "The number of websites depends on your plan: Starter includes 1 website, Pro includes 3, Business includes 6, and Agency includes 15 websites.",
  },
  {
    question: "Can I connect my own domain?",
    answer:
      "Yes. Every plan includes 1 Free Custom Domain connection (1 custom domain on Starter, and 1 custom domain included on Pro, Business, and Agency) with an active paid subscription. Connecting your own domain is included with your subscription.",
  },
  {
    question: "How does the 10-day Free Trial work?",
    answer:
      "When you create your first website on the Free plan, it receives a 10-day initial trial with fast hosting (10-Day Free Trial Subdomain included) and 50 AI credits. During this trial, your website is publicly accessible. After 10 days, public visitor access is paused, but your website pages, designs, and content are safely preserved in your dashboard for 90 days. You can upgrade to an active paid plan anytime to restore public hosting and connect custom domains.",
  },
  {
    question: "Is SEO included in all plans?",
    answer:
      "All plans include Basic SEO Essentials (on-page metadata, robots.txt, sitemaps, and local Cheerio audits). Advanced SEO tools and intelligence (Technical Crawling, Competitor Analysis, AI Content Suggestions, and GSC Sync) are included in Pro, Business, and Agency plans. Autonomous SEO Autopilot is available on Business and Agency, and White-Label Client Reports are exclusive to Agency.",
  },
  {
    question: "What is the Digital Marketing Suite Add-on?",
    answer:
      "The Digital Marketing Suite is an optional add-on available for any plan. It equips your websites with advanced SEO intelligence, multi-engine AI search visibility tracking, autonomous SEO autopilot, AI content marketing, marketing campaign planning, and advanced reporting.",
  },
  {
    question: "What are AI Credits used for?",
    answer:
      "AI Credits are used for AI operations such as initial website generation (10 credits), AI visual editing (5 credits), full page regeneration (15 credits), and AI SEO content suggestions (5 credits). Credits replenish every 30 days without rollover.",
  },
  {
    question: "Can I upgrade my plan later?",
    answer:
      "Yes. You can upgrade your subscription at any time as your website and business requirements grow.",
  },
  {
    question: "Can I use Codeaxys for business and client websites?",
    answer:
      "Yes. Codeaxys is built for businesses, agencies, freelancers, startups, and professionals. Agency plans additionally include White-Label Client Reports and multi-user team collaboration.",
  },
];

export interface PricingPlanMeta {
  id: string;
  name: string;
  popular?: boolean;
  description: string;
  websiteLimit: string;
  aiCredits: string;
  storage: string;
  domain: string;
}

// Exactly 4 plans with only plan-specific capacity values differing
export const PRICING_PLANS: PricingPlanMeta[] = [
  {
    id: "starter",
    name: "Starter",
    description: "For individuals, startups and small businesses.",
    websiteLimit: "1 Website",
    aiCredits: "100 AI Credits / Month",
    storage: "2 GB Storage",
    domain: "1 Free Custom Domain",
  },
  {
    id: "pro",
    name: "Pro",
    popular: true,
    description: "For growing businesses and creators.",
    websiteLimit: "3 Websites",
    aiCredits: "200 AI Credits / Month",
    storage: "10 GB Storage",
    domain: "1 Free Custom Domain",
  },
  {
    id: "business",
    name: "Business",
    description: "For established businesses and teams.",
    websiteLimit: "6 Websites",
    aiCredits: "400 AI Credits / Month",
    storage: "30 GB Storage",
    domain: "1 Free Custom Domain",
  },
  {
    id: "agency",
    name: "Agency",
    description: "For agencies and web professionals.",
    websiteLimit: "15 Websites",
    aiCredits: "800 AI Credits / Month",
    storage: "100 GB Storage",
    domain: "1 Free Custom Domain",
  },
];

// Meaningful Lucide icons mapped to each individual feature
export const FEATURE_ICON_MAP: Record<string, React.ElementType> = {
  // Website Builder
  "AI Website Generation": Sparkles,
  "AI Website Editing & Regeneration": Sliders,
  "Visual Website Editor": Layout,
  "Responsive Website Preview": Smartphone,
  "SSL Security": ShieldCheck,
  "Website Migration": ArrowRightLeft,
  "Website Migration + Redesign": Palette,
  "Contact Forms & Lead Capture": Mail,

  // SEO Essentials
  "SEO Meta Titles & Descriptions": FileText,
  "Open Graph & Canonical URLs": Link2,
  "XML Sitemap & Robots.txt": FileCode,
  "Basic SEO Health Checks": Activity,
  "Schema Markup": Code2,
  "Focus Keywords & On-Page SEO": Target,
  "SEO-Friendly URLs": Globe,
  "LLMs.txt Generation": Bot,

  // Social Media Management
  "Social Media Content Creation": PenTool,
  "AI Captions & Hashtag Generation": Hash,
  "Social Media Campaign Planning": Compass,
  "Social Media Content Calendar": Calendar,
  "Social Media Post Scheduling": Clock,
  "Social Media Publishing": Send,
  "Social Media Performance Analytics": BarChart2,
};

// Single source of truth for all four cards (Identical features, section headings, order, and styling)
export const SHARED_FEATURE_SECTIONS = [
  {
    category: "website_builder",
    title: "WEBSITE BUILDER",
    icon: Layout,
    isBold: false,
    collapsible: false,
    headerBg: "bg-slate-50/90 border-slate-200/80 text-slate-800",
    iconBg: "bg-purple-100 text-[#6938ef]",
    features: [
      "AI Website Generation",
      "AI Website Editing & Regeneration",
      "Visual Website Editor",
      "Responsive Website Preview",
      "SSL Security",
      "Website Migration",
      "Website Migration + Redesign",
      "Contact Forms & Lead Capture",
    ],
  },
  {
    category: "seo_essentials",
    title: "SEO ESSENTIALS",
    icon: Search,
    isBold: true,
    collapsible: true,
    headerBg: "bg-purple-50/70 hover:bg-purple-100/70 border-purple-200/90 text-slate-900",
    iconBg: "bg-[#6938ef] text-white shadow-xs",
    features: [
      "SEO Meta Titles & Descriptions",
      "Open Graph & Canonical URLs",
      "XML Sitemap & Robots.txt",
      "Basic SEO Health Checks",
      "Schema Markup",
      "Focus Keywords & On-Page SEO",
      "SEO-Friendly URLs",
      "LLMs.txt Generation",
    ],
  },
  {
    category: "social_media",
    title: "SOCIAL MEDIA MANAGEMENT",
    icon: Share2,
    isBold: false,
    collapsible: true,
    headerBg: "bg-slate-50/90 hover:bg-slate-100/90 border-slate-200/80 text-slate-800",
    iconBg: "bg-indigo-100 text-indigo-700",
    features: [
      "Social Media Content Creation",
      "AI Captions & Hashtag Generation",
      "Social Media Campaign Planning",
      "Social Media Content Calendar",
      "Social Media Post Scheduling",
      "Social Media Publishing",
      "Social Media Performance Analytics",
    ],
  },
];

// Approved Digital Marketing Suite Features (Strict 6 features with unified Lucide icon system)
export const DIGITAL_MARKETING_FEATURES = [
  {
    title: "SEO Intelligence",
    icon: SearchCheck,
    description:
      "Advanced technical SEO, competitor analysis, content gaps and keyword intelligence.",
  },
  {
    title: "AI Search Visibility",
    icon: ChartNoAxesCombined,
    description: "AEO/GEO analysis and AI visibility tracking.",
  },
  {
    title: "SEO Autopilot",
    icon: Settings2,
    description: "SEO opportunities, recommendations and proposed fixes.",
  },
  {
    title: "AI Content Marketing",
    icon: FilePen,
    description: "SEO-friendly blogs, articles and social content.",
  },
  {
    title: "Marketing Campaign Planning",
    icon: CalendarDays,
    description: "AI-assisted marketing strategy and content calendar.",
  },
  {
    title: "Advanced Reporting",
    icon: ChartPie,
    description: "SEO progress reports and marketing insights.",
  },
];
