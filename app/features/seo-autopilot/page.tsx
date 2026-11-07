import React from "react";
import type { Metadata } from "next";
import { getFeaturePageStructuredData } from "@/lib/schema";
import { FeaturePageLayout } from "@/components/FeaturePageLayout";

const SLUG = "seo-autopilot";
const TITLE = "SEO Autopilot — Autonomous Website Optimization";
const DESCRIPTION =
  "Autonomous SEO optimization agent that continuously crawls, audits, and proposes fixes for your website. 1-click approval workflow, automated schema markup, and revertible snapshot rollbacks.";

const FAQS = [
  {
    question: "What is SEO Autopilot and how does it work?",
    answer:
      "SEO Autopilot is an intelligent agent built into Codeaxys that continuously crawls your website, detects technical SEO deficiencies (missing tags, broken links, slow resources, schema errors), and writes staged code and content fixes ready for 1-click deployment.",
  },
  {
    question: "Does SEO Autopilot modify my website without my approval?",
    answer:
      "By default, all optimization proposals are staged for your review. You inspect the proposed changes and click 'Approve Fix' before anything goes live. You can also configure trusted rules for autonomous continuous application.",
  },
  {
    question: "Which plans include the advanced SEO Autopilot engine?",
    answer:
      "Basic SEO Essentials (dynamic sitemaps, robots.txt, and meta tag controls) are included on all plans. The advanced SEO Autopilot suite (autonomous technical crawls, AI recommendations, and staged 1-click fix deployment) is available on Business and Agency plans.",
  },
  {
    question: "Can I roll back an optimization fix if I change my mind?",
    answer:
      "Yes. Every fix executed through SEO Autopilot includes instant safety snapshotting. If you want to revert an update, simply click 'Rollback' in your dashboard to immediately restore the prior state.",
  },
  {
    question: "How does SEO Autopilot compare to hiring a traditional SEO agency?",
    answer:
      "Traditional SEO agencies charge thousands of dollars monthly to deliver static spreadsheet audits that you still have to manually implement. SEO Autopilot runs recurring background audits, writes the actual fixes, and deploys them with 1 click at a fraction of the cost.",
  },
  {
    question: "Does SEO Autopilot improve Core Web Vitals and page speed?",
    answer:
      "Yes. The crawler flags oversized assets, missing image dimensions, render-blocking scripts, and layout shift triggers, providing automated optimizations to keep your Core Web Vitals green.",
  },
];

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "https://codeaxys.com/features/seo-autopilot",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://codeaxys.com/features/seo-autopilot",
    siteName: "Codeaxys",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function SeoAutopilotPage() {
  const structuredData = getFeaturePageStructuredData({
    slug: SLUG,
    title: TITLE,
    description: DESCRIPTION,
    faqs: FAQS,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <FeaturePageLayout
        slug={SLUG}
        featureName="SEO Autopilot"
        badgeText="Autonomous Optimization Agent"
        heroHeadline="Autonomous Website SEO"
        heroHeadlineAccent="on Complete Autopilot."
        heroSubheadline="Stop manually auditing spreadsheets. Codeaxys SEO Autopilot runs scheduled site audits, detects technical issues, writes the fixes, and deploys optimizations with 1-click approvals."
        primaryCtaText="Explore SEO Autopilot"
        primaryCtaHref="/#hero-generator"
        secondaryCtaText="View Pricing Plans"
        secondaryCtaHref="/pricing"
        trustPoints={[
          "Scheduled automated site crawling",
          "1-click fix approval workflow",
          "One-click snapshot rollbacks",
          "Included in Business & Agency plans",
        ]}
        explanation={{
          badge: "Autonomous Growth Loop",
          headline: "From static audit reports to self-optimizing websites.",
          description:
            "Most SEO tools dump hundreds of warnings into a confusing dashboard and leave you to fix the code yourself. SEO Autopilot closes the loop. It acts as an autonomous engineer that inspects your live site, writes the required Schema.org structured data, meta descriptions, canonical links, and image alt tags, and stages them for instantaneous 1-click deployment.",
          highlights: [
            "Scheduled background crawling that catches indexation errors and broken links early",
            "Contextual AI agent that writes tailored meta descriptions and semantic headings",
            "Structured data engine that automatically generates Organization, WebSite, and FAQ schema",
            "Full revision snapshotting enabling simple 1-click rollbacks",
          ],
          callout: {
            title: "Business & Agency Tier Feature",
            description:
              "Basic SEO Essentials (meta tags, robots.txt, sitemaps) are included on all plans. The autonomous SEO Agent, technical crawling, and 1-click fix workflows are unlocked on Business ($79/mo) and Agency ($199/mo) plans.",
          },
        }}
        capabilities={[
          {
            title: "Scheduled Technical Crawl Audits",
            description:
              "Automated crawlers monitor page response times, 404 links, redirect chains, heading hierarchies, and canonical accuracy on recurring schedules.",
            icon: "gauge",
            badge: "Automated Crawls",
          },
          {
            title: "AI Staged Fix Proposals",
            description:
              "When an issue is identified, the SEO Agent doesn't just alert you — it writes the actual code fix and presents it for your review.",
            icon: "bot",
            badge: "Automated Code",
          },
          {
            title: "1-Click Fix Approvals",
            description:
              "Review proposed optimizations in a simple before/after diff. Approve with a single click or let the agent run autonomously.",
            icon: "checkCircle",
            badge: "1-Click Action",
          },
          {
            title: "Automated Schema.org Structured Data",
            description:
              "Generates and updates rich JSON-LD markup for Organizations, Breadcrumbs, SoftwareApplications, and FAQs to boost Google rich snippets.",
            icon: "fileCode",
            badge: "Rich Snippets",
          },
          {
            title: "Dynamic Sitemap & Robots Synchronization",
            description:
              "Whenever you publish or update pages, your XML sitemap and crawler instructions update immediately to guide search bots effectively.",
            icon: "searchCheck",
            badge: "Auto-Synced",
          },
          {
            title: "Revertible Snapshot Rollbacks",
            description:
              "Every automated optimization creates an atomic snapshot. Roll back any fix simply with a single click if needed.",
            icon: "rotateCcw",
            badge: "Safe Rollback",
          },
        ]}
        workflow={{
          badge: "Autonomous 4-Step Cycle",
          headline: "How SEO Autopilot Optimizes Your Site",
          description:
            "A closed-loop engine that diagnoses, fixes, deploys, and verifies search performance.",
          steps: [
            {
              stepNumber: "01",
              title: "Continuous Crawl",
              description:
                "The agent crawls your site structure, testing every URL for technical issues, meta gaps, and speed bottlenecks.",
              badge: "Detect",
            },
            {
              stepNumber: "02",
              title: "AI Writes the Fix",
              description:
                "The SEO Agent generates optimized titles, meta descriptions, image alt tags, or schema code to fix each issue.",
              badge: "Resolve",
            },
            {
              stepNumber: "03",
              title: "1-Click Review",
              description:
                "You inspect the prioritized backlog in your dashboard and click 'Approve Fix' to confirm the change.",
              badge: "Control",
            },
            {
              stepNumber: "04",
              title: "Deploy & Verify",
              description:
                "Codeaxys updates your live site immediately, submits changes to search engines, and verifies indexing status.",
              badge: "Live",
            },
          ],
        }}
        useCases={{
          badge: "Built for Growth",
          headline: "Who Relies on SEO Autopilot?",
          description:
            "From founders without an in-house SEO team to agencies managing optimization across multiple clients.",
          personas: [
            {
              title: "Bootstrapped Founders",
              subtitle: "Enterprise SEO on an Indie Budget",
              icon: "zap",
              description:
                "Focus on building your product while SEO Autopilot monitors search vitals, fixes broken links, and maximizes organic discovery.",
              points: [
                "Zero manual SEO overhead",
                "Automated schema & meta tags",
                "High organic search visibility",
              ],
            },
            {
              title: "Marketing Agencies",
              subtitle: "Automate Client SEO Deliverables",
              icon: "layout",
              description:
                "Provide hands-off technical SEO for up to 15 client websites. Generate white-label client reports and automate routine optimizations.",
              points: [
                "Manage multiple client sites",
                "Automated 1-click approvals",
                "White-label branded reporting",
              ],
            },
            {
              title: "Scaling Businesses",
              subtitle: "Protect Brand Search Rankings",
              icon: "shield",
              description:
                "Prevent catastrophic ranking drops caused by broken links, missing redirects, or unindexed pages as your website expands.",
              points: [
                "Immediate drop alerts",
                "Automated XML sitemap sync",
                "Continuous Core Web Vitals health",
              ],
            },
          ],
        }}
        visualShowcase={{
          badge: "Agent Dashboard Mockup",
          headline: "The SEO Autopilot Control Deck",
          description:
            "A centralized cockpit showing live site health, detected opportunities, and 1-click fix buttons.",
        }}
        relatedFeatures={[
          {
            title: "AI Search Visibility & AEO",
            description:
              "Optimize your website for citations and discovery across ChatGPT, Perplexity, Claude, and Gemini.",
            href: "/features/ai-search-visibility",
            icon: "searchCheck",
            badge: "AEO / GEO Radar",
          },
          {
            title: "AI Website Builder",
            description:
              "Generate complete multi-page websites rapidly from conversational prompts.",
            href: "/features/ai-website-builder",
            icon: "sparkles",
            badge: "Prompt-to-Code",
          },
          {
            title: "Website Migration & Redesign",
            description:
              "Import an existing website URL to extract assets, content, and structure with an automated modern redesign.",
            href: "/features/website-migration",
            icon: "arrowRightLeft",
            badge: "URL Importer",
          },
        ]}
        faqs={FAQS}
        finalCta={{
          badge: "Hands-Free Optimization",
          headline: "Put Your Website's SEO on Autopilot",
          description:
            "Stop fixing technical SEO bugs by hand. Let Codeaxys detect, stage, and deploy optimization fixes continuously.",
          primaryCtaText: "Upgrade to Business Plan",
          primaryCtaHref: "/pricing",
          secondaryCtaText: "Start Free Trial",
          secondaryCtaHref: "/#hero-generator",
        }}
      />
    </>
  );
}
