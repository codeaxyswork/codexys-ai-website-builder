/**
 * Codeaxys AI Website Builder — Verified Plan Features Catalog
 * Provides transparent, categorized, and plain-language feature definitions
 * for the "View All Features" interaction across all four paid tiers.
 *
 * SAFETY INVARIANT: Mock-only or incomplete features are clearly flagged
 * so customers are never misled about operational capabilities.
 */

export interface CategorizedPlanFeature {
  name: string;
  category: "core_builder" | "hosting_domains" | "seo_intelligence" | "capacity_credits" | "agency_tools";
  categoryLabel: string;
  description: string;
  availability: "included" | "unavailable" | "preview_only";
  badgeText?: string;
}

export interface PlanFeatureCategoryGroup {
  category: string;
  categoryLabel: string;
  features: CategorizedPlanFeature[];
}

export interface CompletePlanFeatures {
  planId: string;
  planName: string;
  summary: string;
  websiteLimit: number;
  monthlyCredits: number;
  storageFormatted: string;
  customDomainConnectionLimit: number;
  domainOfferEligibleIn36m: boolean;
  categoryGroups: PlanFeatureCategoryGroup[];
}

export function getCompletePlanFeatures(planId: string): CompletePlanFeatures {
  const normPlan = (planId || "starter").toLowerCase().trim();

  if (normPlan === "agency") {
    return {
      planId: "agency",
      planName: "Agency",
      summary: "Designed for web agencies, marketing firms, and multi-client operators needing maximum scale and white-label client delivery.",
      websiteLimit: 15,
      monthlyCredits: 800,
      storageFormatted: "100 GB",
      customDomainConnectionLimit: 15,
      domainOfferEligibleIn36m: true,
      categoryGroups: [
        {
          category: "core_builder",
          categoryLabel: "AI Website Builder & Canvas",
          features: [
            {
              name: "Conversational AI Website Generation",
              category: "core_builder",
              categoryLabel: "AI Website Builder & Canvas",
              description: "Build complete multi-page websites instantly through conversational prompts and AI refinement.",
              availability: "included",
            },
            {
              name: "Visual Drag-and-Drop Canvas & Section Editor",
              category: "core_builder",
              categoryLabel: "AI Website Builder & Canvas",
              description: "Customize layouts, blocks, and elements with direct real-time visual controls.",
              availability: "included",
            },
            {
              name: "Unlimited Page Creation",
              category: "core_builder",
              categoryLabel: "AI Website Builder & Canvas",
              description: "Create landing pages, service pages, and case studies without artificial page count limits.",
              availability: "included",
            },
            {
              name: "Clean HTML & CSS Code Export",
              category: "core_builder",
              categoryLabel: "AI Website Builder & Canvas",
              description: "Export full static HTML, CSS, and asset bundles for client handoff or external hosting.",
              availability: "included",
            },
          ],
        },
        {
          category: "hosting_domains",
          categoryLabel: "Cloud Hosting & Custom Domains",
          features: [
            {
              name: "15 Production Website Slots",
              category: "hosting_domains",
              categoryLabel: "Cloud Hosting & Custom Domains",
              description: "Host up to 15 completely distinct client websites on high-performance cloud infrastructure.",
              availability: "included",
            },
            {
              name: "15 Custom Domain Connections",
              category: "hosting_domains",
              categoryLabel: "Cloud Hosting & Custom Domains",
              description: "Connect customer-owned custom domains to all 15 websites with automatic SSL certificate provisioning.",
              availability: "included",
            },
            {
              name: "1 Free Domain Registration (36-Month Offer)",
              category: "hosting_domains",
              categoryLabel: "Cloud Hosting & Custom Domains",
              description: "Under qualifying 36-month prepaid plans, receive 1 free eligible standard domain (.com, .in, .net, .org) for the 1st year. Standard registry renewal fees apply in Years 2 and 3.",
              availability: "included",
              badgeText: "36-Mo Offer Only",
            },
          ],
        },
        {
          category: "seo_intelligence",
          categoryLabel: "SEO & Search Engine Intelligence",
          features: [
            {
              name: "Basic SEO Essentials & Health Audits",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Automated on-page meta titles, descriptions, social OpenGraph tags, sitemaps, and robots.txt.",
              availability: "included",
            },
            {
              name: "AI SEO Suggestions & Content Studio",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Real-time AI suggestions for page copy, heading structure, and search intent keyword density.",
              availability: "included",
            },
            {
              name: "JSON-LD Rich Snippet Schema Engine",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Generates structured data markup for Local Business, Organization, and FAQ rich search results.",
              availability: "included",
            },
            {
              name: "Deep Technical Site Crawl Diagnostics",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Automated crawl for broken links, redirect chains, Core Web Vitals, and internal linking structure.",
              availability: "included",
            },
            {
              name: "Competitor Domain Tracking & Gap Analysis",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Track competitor positions, content coverage gaps, and keyword opportunities across niches.",
              availability: "included",
            },
            {
              name: "Multi-Engine AI Visibility Tracker",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Probe and track brand prominence across OpenAI ChatGPT, Perplexity, Gemini, and Claude.",
              availability: "included",
            },
            {
              name: "Autonomous SEO Autopilot & Fix Agent",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Autonomous agent analyzes crawl issues and generates instant one-click code and meta repairs.",
              availability: "included",
            },
          ],
        },
        {
          category: "capacity_credits",
          categoryLabel: "AI Credits & Storage Quotas",
          features: [
            {
              name: "800 Monthly AI Credits",
              category: "capacity_credits",
              categoryLabel: "AI Credits & Storage Quotas",
              description: "Allowance for website builds, section regenerations, and AI SEO operations. Replenished every 30 days without rollover.",
              availability: "included",
            },
            {
              name: "100 GB High-Speed Media Storage",
              category: "capacity_credits",
              categoryLabel: "AI Credits & Storage Quotas",
              description: "Generous media storage quota for high-resolution images, brand graphics, and client downloads.",
              availability: "included",
            },
          ],
        },
        {
          category: "agency_tools",
          categoryLabel: "Agency & Client Delivery",
          features: [
            {
              name: "White-Label Agency Client Reports",
              category: "agency_tools",
              categoryLabel: "Agency & Client Delivery",
              description: "Generate client-ready, unbranded or custom-branded audit PDFs with your agency name and logo.",
              availability: "included",
            },
            {
              name: "Advanced Third-Party Integrations & GSC Sync",
              category: "agency_tools",
              categoryLabel: "Agency & Client Delivery",
              description: "Connect Google Search Console and external SEO data streams with server-side Agency verification.",
              availability: "included",
            },
            {
              name: "Digital Marketing & Meta Ads Planner",
              category: "agency_tools",
              categoryLabel: "Agency & Client Delivery",
              description: "AI-assisted ad copy, headline variations, and campaign structure generation.",
              availability: "included",
            },
            {
              name: "Google Ads Live Publishing",
              category: "agency_tools",
              categoryLabel: "Agency & Client Delivery",
              description: "Direct live publishing to Google Ads API is currently unavailable and in mock-only preview.",
              availability: "unavailable",
              badgeText: "Unavailable / Mock-Only",
            },
          ],
        },
      ],
    };
  }

  if (normPlan === "business") {
    return {
      planId: "business",
      planName: "Business",
      summary: "Built for scaling businesses, e-commerce brands, and growing companies managing multiple commercial web properties.",
      websiteLimit: 6,
      monthlyCredits: 400,
      storageFormatted: "30 GB",
      customDomainConnectionLimit: 6,
      domainOfferEligibleIn36m: true,
      categoryGroups: [
        {
          category: "core_builder",
          categoryLabel: "AI Website Builder & Canvas",
          features: [
            {
              name: "Conversational AI Website Generation",
              category: "core_builder",
              categoryLabel: "AI Website Builder & Canvas",
              description: "Build full multi-page websites quickly through conversational prompts and AI assistance.",
              availability: "included",
            },
            {
              name: "Visual Drag-and-Drop Canvas & Section Editor",
              category: "core_builder",
              categoryLabel: "AI Website Builder & Canvas",
              description: "Fine-tune design, typography, color palettes, and component hierarchy visually.",
              availability: "included",
            },
            {
              name: "Unlimited Page Creation",
              category: "core_builder",
              categoryLabel: "AI Website Builder & Canvas",
              description: "Create as many pages and sub-pages as your business websites require.",
              availability: "included",
            },
            {
              name: "Clean HTML & CSS Code Export",
              category: "core_builder",
              categoryLabel: "AI Website Builder & Canvas",
              description: "Download production-ready static assets for complete ownership and portable hosting.",
              availability: "included",
            },
          ],
        },
        {
          category: "hosting_domains",
          categoryLabel: "Cloud Hosting & Custom Domains",
          features: [
            {
              name: "6 Production Website Slots",
              category: "hosting_domains",
              categoryLabel: "Cloud Hosting & Custom Domains",
              description: "Host up to 6 distinct commercial websites with high uptime and global edge caching.",
              availability: "included",
            },
            {
              name: "6 Custom Domain Connections",
              category: "hosting_domains",
              categoryLabel: "Cloud Hosting & Custom Domains",
              description: "Connect customer-owned domains to each of your 6 websites with automated SSL certificates.",
              availability: "included",
            },
            {
              name: "1 Free Domain Registration (36-Month Offer)",
              category: "hosting_domains",
              categoryLabel: "Cloud Hosting & Custom Domains",
              description: "Under qualifying 36-month prepaid plans, receive 1 free eligible standard domain (.com, .in, .net, .org) for the 1st year. Standard registry renewal fees apply in Years 2 and 3.",
              availability: "included",
              badgeText: "36-Mo Offer Only",
            },
          ],
        },
        {
          category: "seo_intelligence",
          categoryLabel: "SEO & Search Engine Intelligence",
          features: [
            {
              name: "Basic SEO Essentials & Sitemaps",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Full on-page meta tags, social OpenGraph cards, Cheerio health audit, and XML sitemaps.",
              availability: "included",
            },
            {
              name: "AI SEO Suggestions & Content Studio",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "AI-guided content optimization and target keyword positioning across all pages.",
              availability: "included",
            },
            {
              name: "JSON-LD Rich Snippet Schema Engine",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Rich snippet structured data markup for Local Business, Organization, and FAQ search previews.",
              availability: "included",
            },
            {
              name: "Deep Technical Site Crawl Diagnostics",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Automated crawl for broken links, redirect chains, Core Web Vitals, and internal linking structure.",
              availability: "included",
            },
            {
              name: "Competitor Domain Tracking & Gap Analysis",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Analyze competitor rankings and uncover lucrative content opportunities in your market.",
              availability: "included",
            },
            {
              name: "Multi-Engine AI Visibility Tracker",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Track prompt citations across ChatGPT, Perplexity, Gemini, and Claude.",
              availability: "included",
            },
            {
              name: "Autonomous SEO Autopilot & Fix Agent",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Autonomous scanner detects technical SEO issues and applies one-click repairs automatically.",
              availability: "included",
            },
          ],
        },
        {
          category: "capacity_credits",
          categoryLabel: "AI Credits & Storage Quotas",
          features: [
            {
              name: "400 Monthly AI Credits",
              category: "capacity_credits",
              categoryLabel: "AI Credits & Storage Quotas",
              description: "Monthly allowance for website builds, copy refinement, and SEO fixes. Replenished every 30 days without rollover.",
              availability: "included",
            },
            {
              name: "30 GB High-Speed Media Storage",
              category: "capacity_credits",
              categoryLabel: "AI Credits & Storage Quotas",
              description: "Reliable cloud storage for product photography, media assets, and marketing collateral.",
              availability: "included",
            },
          ],
        },
        {
          category: "agency_tools",
          categoryLabel: "Agency & Client Delivery",
          features: [
            {
              name: "White-Label Agency Client Reports",
              category: "agency_tools",
              categoryLabel: "Agency & Client Delivery",
              description: "Unbranded client reporting is reserved for the Agency plan or optional Agency Bundle.",
              availability: "unavailable",
              badgeText: "Agency Only / Bundle Preview",
            },
            {
              name: "Advanced Third-Party Integrations & GSC Sync",
              category: "agency_tools",
              categoryLabel: "Agency & Client Delivery",
              description: "Direct API sync endpoints require Agency plan entitlement or optional Agency Bundle.",
              availability: "unavailable",
              badgeText: "Agency Only / Bundle Preview",
            },
          ],
        },
      ],
    };
  }

  if (normPlan === "pro") {
    return {
      planId: "pro",
      planName: "Pro",
      summary: "Ideal for independent professionals, boutique creators, and growing businesses needing advanced SEO and AI visibility.",
      websiteLimit: 3,
      monthlyCredits: 200,
      storageFormatted: "10 GB",
      customDomainConnectionLimit: 3,
      domainOfferEligibleIn36m: true,
      categoryGroups: [
        {
          category: "core_builder",
          categoryLabel: "AI Website Builder & Canvas",
          features: [
            {
              name: "Conversational AI Website Generation",
              category: "core_builder",
              categoryLabel: "AI Website Builder & Canvas",
              description: "Build beautiful websites with AI prompts, custom themes, and instant code generation.",
              availability: "included",
            },
            {
              name: "Visual Drag-and-Drop Canvas & Section Editor",
              category: "core_builder",
              categoryLabel: "AI Website Builder & Canvas",
              description: "Visual controls for layouts, typography, brand colors, and responsive previews.",
              availability: "included",
            },
            {
              name: "Unlimited Page Creation",
              category: "core_builder",
              categoryLabel: "AI Website Builder & Canvas",
              description: "Create all the pages your projects require without arbitrary limitations.",
              availability: "included",
            },
            {
              name: "Clean HTML & CSS Code Export",
              category: "core_builder",
              categoryLabel: "AI Website Builder & Canvas",
              description: "Export clean static site bundles for total independence and backup peace of mind.",
              availability: "included",
            },
          ],
        },
        {
          category: "hosting_domains",
          categoryLabel: "Cloud Hosting & Custom Domains",
          features: [
            {
              name: "3 Production Website Slots",
              category: "hosting_domains",
              categoryLabel: "Cloud Hosting & Custom Domains",
              description: "Create and publish up to 3 separate websites simultaneously.",
              availability: "included",
            },
            {
              name: "3 Custom Domain Connections",
              category: "hosting_domains",
              categoryLabel: "Cloud Hosting & Custom Domains",
              description: "Connect customer-owned domains (e.g., yoursite.com) to all 3 websites with free SSL.",
              availability: "included",
            },
            {
              name: "1 Free Domain Registration (36-Month Offer)",
              category: "hosting_domains",
              categoryLabel: "Cloud Hosting & Custom Domains",
              description: "Under qualifying 36-month prepaid plans, receive 1 free eligible standard domain (.com, .in, .net, .org) for the 1st year. Standard registry renewal fees apply in Years 2 and 3.",
              availability: "included",
              badgeText: "36-Mo Offer Only",
            },
          ],
        },
        {
          category: "seo_intelligence",
          categoryLabel: "SEO & Search Engine Intelligence",
          features: [
            {
              name: "Basic SEO Essentials & Sitemaps",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Automated on-page meta titles, descriptions, social OpenGraph tags, sitemaps, and robots.txt.",
              availability: "included",
            },
            {
              name: "AI SEO Suggestions & Content Studio",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Intelligent keyword intent recommendations and real-time page content scoring.",
              availability: "included",
            },
            {
              name: "JSON-LD Rich Snippet Schema Engine",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Structured data generation for Local Business, Organization, and FAQ search previews.",
              availability: "included",
            },
            {
              name: "Deep Technical Site Crawl Diagnostics",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Diagnose broken links, redirect chains, Core Web Vitals, and technical health.",
              availability: "included",
            },
            {
              name: "Competitor Domain Tracking & Gap Analysis",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Identify competitor strengths and target actionable keyword content gaps.",
              availability: "included",
            },
            {
              name: "Multi-Engine AI Visibility Tracker",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Monitor how generative AI engines cite and present your brand.",
              availability: "included",
            },
            {
              name: "Autonomous SEO Autopilot & Fix Agent",
              category: "seo_intelligence",
              categoryLabel: "SEO & Search Engine Intelligence",
              description: "Autonomous one-click fixes require the Business or Agency plan, or optional Premium Bundle.",
              availability: "unavailable",
              badgeText: "Business+ / Bundle Preview",
            },
          ],
        },
        {
          category: "capacity_credits",
          categoryLabel: "AI Credits & Storage Quotas",
          features: [
            {
              name: "200 Monthly AI Credits",
              category: "capacity_credits",
              categoryLabel: "AI Credits & Storage Quotas",
              description: "Allowance for website generation and content modifications. Refreshed every 30 days without rollover.",
              availability: "included",
            },
            {
              name: "10 GB High-Speed Media Storage",
              category: "capacity_credits",
              categoryLabel: "AI Credits & Storage Quotas",
              description: "Generous quota for website imagery, downloadable PDFs, and brand media.",
              availability: "included",
            },
          ],
        },
        {
          category: "agency_tools",
          categoryLabel: "Agency & Client Delivery",
          features: [
            {
              name: "White-Label Agency Client Reports",
              category: "agency_tools",
              categoryLabel: "Agency & Client Delivery",
              description: "Unbranded client reporting is exclusive to Agency tier or the optional Premium Bundle.",
              availability: "unavailable",
              badgeText: "Agency Only / Bundle Preview",
            },
          ],
        },
      ],
    };
  }

  // Default: Starter Plan
  return {
    planId: "starter",
    planName: "Starter",
    summary: "The essential package for single-site creators, early startups, and personal brands launching their first professional website.",
    websiteLimit: 1,
    monthlyCredits: 100,
    storageFormatted: "2 GB",
    customDomainConnectionLimit: 1,
    domainOfferEligibleIn36m: true,
    categoryGroups: [
      {
        category: "core_builder",
        categoryLabel: "AI Website Builder & Canvas",
        features: [
          {
            name: "Conversational AI Website Generation",
            category: "core_builder",
            categoryLabel: "AI Website Builder & Canvas",
            description: "Generate a fully responsive website with copy and layout using intuitive AI prompts.",
            availability: "included",
          },
          {
            name: "Visual Drag-and-Drop Canvas & Section Editor",
            category: "core_builder",
            categoryLabel: "AI Website Builder & Canvas",
            description: "Direct visual customization of sections, fonts, color palettes, and components.",
            availability: "included",
          },
          {
            name: "Unlimited Page Creation",
            category: "core_builder",
            categoryLabel: "AI Website Builder & Canvas",
            description: "Add as many pages (About, Contact, Services, FAQs) as your website needs.",
            availability: "included",
          },
          {
            name: "Clean HTML & CSS Code Export",
            category: "core_builder",
            categoryLabel: "AI Website Builder & Canvas",
            description: "Export clean static site code for total backup freedom and offline storage.",
            availability: "included",
          },
        ],
      },
      {
        category: "hosting_domains",
        categoryLabel: "Cloud Hosting & Custom Domains",
        features: [
          {
            name: "1 Production Website Slot",
            category: "hosting_domains",
            categoryLabel: "Cloud Hosting & Custom Domains",
            description: "Publish 1 live, publicly accessible website with fast cloud hosting.",
            availability: "included",
          },
          {
            name: "1 Custom Domain Connection",
            category: "hosting_domains",
            categoryLabel: "Cloud Hosting & Custom Domains",
            description: "Connect 1 customer-owned custom domain (e.g., yourname.com) with an active paid subscription.",
            availability: "included",
          },
          {
            name: "1 Free Domain Registration (36-Month Offer)",
            category: "hosting_domains",
            categoryLabel: "Cloud Hosting & Custom Domains",
            description: "Under qualifying 36-month prepaid plans, receive 1 free eligible standard domain (.com, .in, .net, .org) for the 1st year. Standard registry renewal fees apply in Years 2 and 3.",
            availability: "included",
            badgeText: "36-Mo Offer Only",
          },
        ],
      },
      {
        category: "seo_intelligence",
        categoryLabel: "SEO & Search Engine Intelligence",
        features: [
          {
            name: "Basic SEO Essentials & Sitemaps",
            category: "seo_intelligence",
            categoryLabel: "SEO & Search Engine Intelligence",
            description: "Automated on-page meta title, meta description, Cheerio health check, sitemap, and robots.txt.",
            availability: "included",
          },
          {
            name: "AI SEO Suggestions & Content Studio",
            category: "seo_intelligence",
            categoryLabel: "SEO & Search Engine Intelligence",
            description: "Advanced AI SEO content recommendations require Pro, Business, Agency, or optional Premium Bundle.",
            availability: "unavailable",
            badgeText: "Pro+ / Bundle Preview",
          },
          {
            name: "JSON-LD Rich Snippet Schema Engine",
            category: "seo_intelligence",
            categoryLabel: "SEO & Search Engine Intelligence",
            description: "Automated structured data markup requires Pro, Business, Agency, or optional Premium Bundle.",
            availability: "unavailable",
            badgeText: "Pro+ / Bundle Preview",
          },
          {
            name: "Deep Technical Site Crawl Diagnostics",
            category: "seo_intelligence",
            categoryLabel: "SEO & Search Engine Intelligence",
            description: "Technical crawler diagnostics require Pro, Business, Agency, or optional Premium Bundle.",
            availability: "unavailable",
            badgeText: "Pro+ / Bundle Preview",
          },
          {
            name: "Competitor Domain Tracking & Gap Analysis",
            category: "seo_intelligence",
            categoryLabel: "SEO & Search Engine Intelligence",
            description: "Competitor intelligence requires Pro, Business, Agency, or optional Premium Bundle.",
            availability: "unavailable",
            badgeText: "Pro+ / Bundle Preview",
          },
          {
            name: "Multi-Engine AI Visibility Tracker",
            category: "seo_intelligence",
            categoryLabel: "SEO & Search Engine Intelligence",
            description: "Generative AI search monitoring requires Pro, Business, Agency, or optional Premium Bundle.",
            availability: "unavailable",
            badgeText: "Pro+ / Bundle Preview",
          },
          {
            name: "Autonomous SEO Autopilot & Fix Agent",
            category: "seo_intelligence",
            categoryLabel: "SEO & Search Engine Intelligence",
            description: "Autonomous background fixes require Business, Agency, or optional Premium Bundle.",
            availability: "unavailable",
            badgeText: "Business+ / Bundle Preview",
          },
        ],
      },
      {
        category: "capacity_credits",
        categoryLabel: "AI Credits & Storage Quotas",
        features: [
          {
            name: "100 Monthly AI Credits",
            category: "capacity_credits",
            categoryLabel: "AI Credits & Storage Quotas",
            description: "Monthly allowance for website generation and design edits. Refreshed every 30 days without rollover.",
            availability: "included",
          },
          {
            name: "2 GB High-Speed Media Storage",
            category: "capacity_credits",
            categoryLabel: "AI Credits & Storage Quotas",
            description: "Fast cloud storage for images, logos, and media files.",
            availability: "included",
          },
        ],
      },
      {
        category: "agency_tools",
        categoryLabel: "Agency & Client Delivery",
        features: [
          {
            name: "White-Label Agency Client Reports",
            category: "agency_tools",
            categoryLabel: "Agency & Client Delivery",
            description: "Client reporting requires Agency plan entitlement or optional Premium Bundle.",
            availability: "unavailable",
            badgeText: "Agency Only",
          },
        ],
      },
    ],
  };
}
