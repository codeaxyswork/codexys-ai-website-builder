import React from "react";
import type { Metadata } from "next";
import { getFeaturePageStructuredData } from "@/lib/schema";
import { FeaturePageLayout } from "@/components/FeaturePageLayout";

const SLUG = "website-migration";
const TITLE = "Website Migration & Redesign — Move Your Site to AI";
const DESCRIPTION =
  "Migrate existing websites into modern AI-editable Next.js sites. Input your current URL to extract structure, copy, and media assets, then automatically restyle with modern responsive designs.";

const FAQS = [
  {
    question: "What types of websites can I migrate to Codeaxys?",
    answer:
      "You can migrate publicly accessible websites built on WordPress, Wix, Squarespace, Webflow, static HTML, or custom CMS platforms. Our URL scanner extracts the visual layout, text content, image assets, and navigational structure automatically.",
  },
  {
    question: "Does the migration process affect my existing live website?",
    answer:
      "No. The migration scanner operates strictly as a read-only crawl of your publicly accessible pages. Your live website remains 100% online, untouched, and unaffected throughout the entire process.",
  },
  {
    question: "Are my images, branding, and text copy preserved?",
    answer:
      "Yes. The extraction engine captures your original headings, paragraphs, logos, and media files. When applying a modern redesign, your core brand messaging and assets are preserved and reorganized into modern, responsive sections.",
  },
  {
    question: "Can I choose between an exact structural replica or a modern redesign?",
    answer:
      "Yes. You can choose to maintain your original layout structure or select AI-powered modern restyling to instantly upgrade outdated typography, spacing, and mobile layouts into modern Next.js 15 standards.",
  },
  {
    question: "What are the technical requirements and limitations?",
    answer:
      "The scanner works on publicly accessible pages. Private members-only areas, password-protected portals, and server-side databases (such as custom transactional backends or user login databases) require standard API or data export workflows.",
  },
  {
    question: "How do I switch my custom domain to Codeaxys after migration?",
    answer:
      "Once you review and approve your migrated site in the live preview sandbox, simply add your custom domain in your Codeaxys dashboard and point your DNS records. SSL certificates are provisioned automatically with zero downtime.",
  },
];

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "https://codeaxys.com/features/website-migration",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://codeaxys.com/features/website-migration",
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

export default function WebsiteMigrationPage() {
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
        featureName="Website Migration & Redesign"
        badgeText="URL Importer & AI Restyling"
        heroHeadline="Migrate Any Website to Next.js"
        heroHeadlineAccent="in Minutes, Not Months."
        heroSubheadline="Enter your current website URL. Codeaxys scans pages, preserves brand copy and assets, and restyles dated layouts into lightning-fast, AI-editable Next.js 15 websites."
        primaryCtaText="Start Migration"
        primaryCtaHref="/#hero-generator"
        secondaryCtaText="View Pricing Plans"
        secondaryCtaHref="/pricing"
        trustPoints={[
          "Zero downtime for your live site",
          "Preserves images & copy",
          "Automated mobile responsiveness",
          "Export clean Next.js code",
        ]}
        explanation={{
          badge: "Autonomous Re-Platforming",
          headline: "Escape legacy CMS lock-in without starting from scratch.",
          description:
            "Rebuilding an existing website typically takes agencies weeks of manual copying, pasting, and reformatting. Codeaxys automates the tedious work. Our migration scanner parses your live site's DOM, extracts your content and media, and rebuilds everything using clean React components, Tailwind styling, and modern SEO architecture.",
          highlights: [
            "Non-invasive read-only extraction that never interrupts your live website",
            "Automatic extraction of images, logos, typography, and page copy",
            "AI modern redesign mode converts dated layouts into contemporary SaaS-grade aesthetics",
            "Instant side-by-side comparison snapshots to verify accuracy before publishing",
          ],
          callout: {
            title: "Performance & SEO Leap",
            description:
              "Migrating to Codeaxys replaces heavy legacy CMS plugins and render bottlenecks with lightweight Next.js code designed to improve load performance and search indexation.",
          },
        }}
        capabilities={[
          {
            title: "One-Click URL Scanner",
            description:
              "Simply enter your existing website address. The scanner analyzes DOM hierarchy, page structure, headings, and metadata automatically.",
            icon: "globe",
            badge: "Automated Crawl",
          },
          {
            title: "Asset & Copy Preservation",
            description:
              "Original high-resolution images, brand graphics, product descriptions, and contact details are extracted and organized into your new media library.",
            icon: "fileCheck",
            badge: "100% Preserved",
          },
          {
            title: "AI Modern Responsive Redesign",
            description:
              "Optionally modernize your visual style. Transform dated table layouts and clunky menus into fluid, mobile-first responsive components.",
            icon: "palette",
            badge: "AI Restyling",
          },
          {
            title: "Before & After Visual Snapshots",
            description:
              "Inspect side-by-side visual comparisons between your legacy website and your newly generated Next.js version to verify every detail.",
            icon: "arrowRightLeft",
            badge: "Diff Verification",
          },
          {
            title: "Clean Next.js 15 Architecture",
            description:
              "Replace bloated CMS plugins and security vulnerabilities with clean, high-performance static and server-rendered React components.",
            icon: "code",
            badge: "Zero Plugin Bloat",
          },
          {
            title: "Zero-Downtime Domain Switch",
            description:
              "Connect your production custom domain when you are 100% satisfied. Automatic SSL certificates ensure a seamless cutover for your visitors.",
            icon: "shield",
            badge: "Seamless Cutover",
          },
        ]}
        workflow={{
          badge: "4-Step Migration Workflow",
          headline: "How Website Migration Works",
          description:
            "A seamless transition from your dated legacy host to modern AI-driven infrastructure.",
          steps: [
            {
              stepNumber: "01",
              title: "Provide Your Current URL",
              description:
                "Enter your existing website URL. The scanner safely scans public pages without touching your live server.",
              badge: "Read-Only Scan",
            },
            {
              stepNumber: "02",
              title: "Extract Content & Assets",
              description:
                "Our engine captures text hierarchies, image URLs, styling tokens, and navigation links automatically.",
              badge: "Asset Ingestion",
            },
            {
              stepNumber: "03",
              title: "AI Generates Modern Next.js",
              description:
                "Codeaxys rebuilds your site in modern React and Tailwind, applying responsive mobile design and clean SEO schema.",
              badge: "Code Rebuild",
            },
            {
              stepNumber: "04",
              title: "Review & Connect Domain",
              description:
                "Preview your site in the interactive sandbox, make visual tweaks, and point your DNS for an instant cutover.",
              badge: "Go Live",
            },
          ],
        }}
        useCases={{
          badge: "Real-World Migration Scenarios",
          headline: "Who Migrates with Codeaxys?",
          description:
            "From business owners fed up with WordPress maintenance to agencies redesigning client sites at scale.",
          personas: [
            {
              title: "WordPress & Wix Switchers",
              subtitle: "End the Plugin Maintenance Hell",
              icon: "zap",
              description:
                "Tired of database crashes, slow load times, outdated plugins, and constant security vulnerabilities? Move to zero-maintenance Next.js.",
              points: [
                "Zero plugin updates or security patches",
                "Fast, responsive page loads",
                "Substantial hosting cost savings",
              ],
            },
            {
              title: "Digital Marketing Agencies",
              subtitle: "Fast-Track Client Website Redesigns",
              icon: "layout",
              description:
                "Win more redesign projects by delivering modern client prototypes in minutes instead of taking weeks to manually rebuild legacy sites.",
              points: [
                "Automated asset extraction",
                "Side-by-side client presentation diffs",
                "Export clean deliverables",
              ],
            },
            {
              title: "Growing Small Businesses",
              subtitle: "Modernize Without Losing Content",
              icon: "shield",
              description:
                "Upgrade your decade-old website to look cutting-edge on smartphones and tablets while preserving your hard-earned SEO copy and brand identity.",
              points: [
                "Preserves existing brand messaging",
                "Flawless mobile & tablet layout",
                "Zero downtime cutover",
              ],
            },
          ],
        }}
        visualShowcase={{
          badge: "Migration Simulator",
          headline: "See Legacy Sites Transformed in Real Time",
          description:
            "From dated, un-responsive layouts to modern, high-converting Next.js architecture.",
        }}
        relatedFeatures={[
          {
            title: "AI Website Builder",
            description:
              "Generate complete multi-page websites rapidly from conversational prompts.",
            href: "/features/ai-website-builder",
            icon: "sparkles",
            badge: "Prompt-to-Code",
          },
          {
            title: "In-Canvas Visual Editor",
            description:
              "Fine-tune every element directly on screen with point-and-click ease and conversational AI prompts.",
            href: "/features/visual-editor",
            icon: "sliders",
            badge: "Dual-Mode Editing",
          },
          {
            title: "SEO Autopilot",
            description:
              "Autonomous technical crawl audits, automated issue detection, and 1-click optimization approvals.",
            href: "/features/seo-autopilot",
            icon: "settings",
            badge: "Autonomous Fixes",
          },
        ]}
        faqs={FAQS}
        finalCta={{
          badge: "Modernize Your Site",
          headline: "Ready to Upgrade Your Website to AI?",
          description:
            "Scan your live website today and see your modern Next.js preview in minutes.",
          primaryCtaText: "Start Migration Free",
          primaryCtaHref: "/#hero-generator",
          secondaryCtaText: "View Pricing Plans",
          secondaryCtaHref: "/pricing",
        }}
      />
    </>
  );
}
