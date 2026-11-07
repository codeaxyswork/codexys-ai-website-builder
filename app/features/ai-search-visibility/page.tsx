import React from "react";
import type { Metadata } from "next";
import { getFeaturePageStructuredData } from "@/lib/schema";
import { FeaturePageLayout } from "@/components/FeaturePageLayout";

const SLUG = "ai-search-visibility";
const TITLE = "AI Search Visibility & AEO — Rank in ChatGPT, Perplexity & Gemini";
const DESCRIPTION =
  "Answer Engine Optimization (AEO) and Generative Engine Optimization (GEO). Track citations in AI engines, generate llms.txt context files, and optimize content for LLM discovery.";

const FAQS = [
  {
    question: "What is Answer Engine Optimization (AEO) and GEO?",
    answer:
      "AEO (Answer Engine Optimization) and GEO (Generative Engine Optimization) are methodologies designed to make your website content authoritative, structured, and easily extractable by AI search models like ChatGPT Search, Perplexity AI, Google Gemini, and Claude.",
  },
  {
    question: "What is llms.txt and how does Codeaxys support it?",
    answer:
      "llms.txt is an emerging web standard that provides a clean, Markdown-formatted summary of your website designed specifically for AI crawler context windows. Codeaxys generates and maintains both /llms.txt and /llms-full.txt automatically.",
  },
  {
    question: "Does Codeaxys guarantee my website will appear in AI answers?",
    answer:
      "No legitimate platform can guarantee specific AI engine citations, as LLM responses are probabilistic and dynamic. However, Codeaxys implements all verified technical standards (structured Schema.org data, clean semantic HTML5, verified entity relationships, and llms.txt) that maximize citation probability.",
  },
  {
    question: "How does the AI Citation Radar work?",
    answer:
      "Codeaxys audits your site's readiness for AI ingestion and tracks citation signals. Depending on your configuration, citation tracking connects with supported LLM probe adapters or runs simulated readiness audits to identify gaps in your brand's AI knowledge presence.",
  },
  {
    question: "How does AEO differ from traditional SEO?",
    answer:
      "Traditional SEO focuses on keyword rankings and ten blue links. AEO focuses on entity relationships, direct answer synthesis, factual accuracy, and structured data so that conversational AI models cite your business when answering user queries.",
  },
  {
    question: "Which plans include AI Search Visibility and AEO features?",
    answer:
      "Automated llms.txt publishing, semantic metadata, and Schema.org structured data are included in all websites created on Codeaxys. Advanced citation tracking, deep AEO radar analytics, and AI readiness recommendations are available on Pro, Business, and Agency plans.",
  },
];

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "https://codeaxys.com/features/ai-search-visibility",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://codeaxys.com/features/ai-search-visibility",
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

export default function AiSearchVisibilityPage() {
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
        featureName="AI Search Visibility & AEO"
        badgeText="Answer Engine Optimization (AEO / GEO)"
        heroHeadline="Be the Answer in"
        heroHeadlineAccent="ChatGPT, Perplexity & Gemini."
        heroSubheadline="The next era of search is conversational. Codeaxys structures your website with Schema.org entity graphs, automated llms.txt files, and semantic content optimized for generative AI citation."
        primaryCtaText="Boost AI Visibility"
        primaryCtaHref="/#hero-generator"
        secondaryCtaText="View Pricing Plans"
        secondaryCtaHref="/pricing"
        trustPoints={[
          "Automated llms.txt & llms-full.txt",
          "Rich Schema.org JSON-LD graphs",
          "Optimized for Perplexity & ChatGPT",
          "AEO & GEO readiness scoring",
        ]}
        explanation={{
          badge: "The Future of Discovery",
          headline: "Traditional search is evolving into direct answers.",
          description:
            "Millions of potential customers now search using ChatGPT, Perplexity, Copilot, and Gemini instead of standard search engines. These AI engines do not browse websites like humans; they parse semantic entity graphs, structured data, and concise Markdown contexts. Codeaxys builds your website with the exact technical architecture that answer engines prioritize for citations.",
          highlights: [
            "Automatic generation of /llms.txt and /llms-full.txt machine-readable files",
            "Comprehensive Schema.org graphs (Organization, WebSite, SoftwareApplication, FAQPage)",
            "Clear entity modeling that connects your brand, products, pricing, and founders",
            "Robots.txt directives tailored for legitimate AI search bots (OAI-SearchBot, PerplexityBot)",
          ],
          callout: {
            title: "Transparency & Standards",
            description:
              "Codeaxys generates standards-compliant Markdown context files and Schema.org graphs natively. External AI citation tracking connects with supported LLM probe adapters or provides simulated readiness audits to highlight gaps in your brand's AI discoverability.",
          },
        }}
        capabilities={[
          {
            title: "Automated llms.txt Publication",
            description:
              "Generates and serves /llms.txt and /llms-full.txt so AI crawlers can ingest your core brand offering without scraping HTML overhead.",
            icon: "fileCode",
            badge: "Standard Ready",
          },
          {
            title: "AEO Answer Structuring",
            description:
              "Structures headings, FAQs, and product definitions in concise, direct answer formats engineered for AI snippet extraction.",
            icon: "bot",
            badge: "Direct Answers",
          },
          {
            title: "Generative Engine Optimization (GEO)",
            description:
              "Audits content depth, technical clarity, and factual citations to maximize the likelihood of inclusion in synthesized AI overviews.",
            icon: "sparkles",
            badge: "GEO Scoring",
          },
          {
            title: "Schema.org Entity Graph Modeling",
            description:
              "Builds connected JSON-LD graphs that define your company (#organization), software, pricing, and canonical pages unambiguously.",
            icon: "layers",
            badge: "Linked Data",
          },
          {
            title: "AI Search Bot Access Optimization",
            description:
              "Configures robots.txt specifically to welcome legitimate search and answer engine crawlers while protecting private user data.",
            icon: "shield",
            badge: "Bot Whitelisting",
          },
          {
            title: "AI Citation Radar & Readiness Audits",
            description:
              "Evaluates your website's citation readiness across Perplexity, ChatGPT, Claude, and Gemini to uncover high-impact visibility gaps.",
            icon: "searchCheck",
            badge: "Citation Radar",
          },
        ]}
        workflow={{
          badge: "4-Step AEO Optimization",
          headline: "How Codeaxys Optimizes for Answer Engines",
          description:
            "A comprehensive framework ensuring your brand is recognized, indexed, and cited by generative AI.",
          steps: [
            {
              stepNumber: "01",
              title: "Discoverability Audit",
              description:
                "Analyze existing content, schema markup, and metadata to identify missing entity connections.",
              badge: "Audit",
            },
            {
              stepNumber: "02",
              title: "Deploy Semantic Architecture",
              description:
                "Codeaxys injects JSON-LD graphs and automatically creates /llms.txt for machine consumption.",
              badge: "Structure",
            },
            {
              stepNumber: "03",
              title: "Format for Direct Answers",
              description:
                "Transform verbose text into factual, query-focused sections with integrated FAQPage schema.",
              badge: "Synthesize",
            },
            {
              stepNumber: "04",
              title: "Monitor AI Citation Readiness",
              description:
                "Track how AI engines interpret your brand and refine content to maintain high citation authority.",
              badge: "Track",
            },
          ],
        }}
        useCases={{
          badge: "Tailored for the AI Era",
          headline: "Who Needs AI Search Visibility?",
          description:
            "From tech startups competing with incumbents to local service providers wanting to be recommended by voice assistants.",
          personas: [
            {
              title: "SaaS & AI Startups",
              subtitle: "Get Recommended in Tech Comparisons",
              icon: "zap",
              description:
                "When potential buyers ask ChatGPT 'What is the best alternative to X?', ensure your software is cited with accurate features and pricing.",
              points: [
                "Clear software capability schema",
                "Machine-readable llms.txt",
                "Accurate pricing citations",
              ],
            },
            {
              title: "Professional Consultancies",
              subtitle: "Establish Authority in AI Answers",
              icon: "searchCheck",
              description:
                "Position your partners and firm as verified authoritative sources when executives query generative engines for strategic advice.",
              points: [
                "Verified author & org schema",
                "High-trust citation formatting",
                "Direct answer syntheses",
              ],
            },
            {
              title: "E-Commerce & Service Brands",
              subtitle: "Win Conversational Commerce",
              icon: "globe",
              description:
                "Ensure your services and products appear when shoppers use voice assistants and generative AI shopping assistants.",
              points: [
                "Product & service markup",
                "Instant localized entity sync",
                "Fast AI crawler ingestion",
              ],
            },
          ],
        }}
        visualShowcase={{
          badge: "AEO Radar Mockup",
          headline: "AI Search Visibility & Citation Matrix",
          description:
            "Real-time tracking of brand authority, Schema coverage, and llms.txt validation across major AI models.",
        }}
        relatedFeatures={[
          {
            title: "SEO Autopilot",
            description:
              "Autonomous technical crawl audits, automated issue detection, and 1-click optimization approvals.",
            href: "/features/seo-autopilot",
            icon: "settings",
            badge: "Autonomous Fixes",
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
          badge: "Be AI-Ready",
          headline: "Make Your Website Discoverable by AI Today",
          description:
            "Don't get left behind in the generative search revolution. Build with native AEO and GEO optimization on Codeaxys.",
          primaryCtaText: "Start Building Free",
          primaryCtaHref: "/#hero-generator",
          secondaryCtaText: "View Pricing Plans",
          secondaryCtaHref: "/pricing",
        }}
      />
    </>
  );
}
