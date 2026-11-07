/**
 * Schema.org JSON-LD Structured Data for Codeaxys Marketing Website
 *
 * Implements Google-compliant structured data for:
 * 1. Organization Schema (Codeaxys)
 * 2. WebSite Schema (codeaxys.com)
 * 3. SoftwareApplication Schema (Codeaxys AI Website Builder)
 * 4. FAQPage Schema (Homepage and Pricing FAQs)
 * 5. WebPage Schema (Page-level canonical graphs)
 *
 * Rules:
 * - Only verified, implemented features and company details.
 * - Single source of truth for FAQ content (100% visible match).
 * - Connected Knowledge Graph using @id references.
 * - No fake ratings, downloads, reviews, or unsupported application claims.
 */

export const SITE_URL = "https://codeaxys.com";
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const SOFTWARE_APPLICATION_ID = `${SITE_URL}/#software`;
export const LOGO_URL = `${SITE_URL}/logo.png`;
export const SUPPORT_EMAIL = "admin@codeaxys.com";

/**
 * 11 Visible FAQs from Pricing Page
 */
export const PRICING_FAQ_ITEMS = [
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
      "When you create your first website on the Free plan, it receives a 10-day initial trial with fast hosting (10-Day Free Trial Subdomain included) and 50 AI credits. During this trial, your website is publicly accessible. After 10 days, public visitor access is paused, but your website pages, designs, and content are safely preserved in your dashboard for 90 days. You can upgrade to any paid plan anytime to restore public hosting and connect custom domains.",
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

/**
 * 13 Visible FAQs from Homepage
 */
export const HOMEPAGE_FAQ_ITEMS = [
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
      "Every plan includes AI website generation, website editing, unlimited page creation, responsive design tools, global styling controls, and Basic SEO Essentials.",
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
    answer:
      "Yes. Starter includes 1 custom domain with an active paid subscription. Pro, Business, and Agency plans include custom domain connections for all your websites.",
  },
  {
    question: "How does the 10-day Free Trial work?",
    answer:
      "The Free plan provides a 10-day initial trial with 50 AI credits, 1 website slot, and fast subdomain hosting. Your site is publicly live during the 10 days. After 10 days, public hosting is paused, but your website content and designs remain safely preserved in your dashboard for 90 days. You can upgrade to any paid plan to restore public hosting and connect custom domains.",
  },
  {
    question: "Is SEO included in all plans?",
    answer:
      "Basic SEO Essentials (meta tags, sitemaps, and robots.txt) are included in all plans. The Advanced SEO Suite (technical crawls, keyword tracking, competitor analysis, and AI recommendations) is available on Pro, Business, and Agency plans.",
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

/**
 * 1. Organization Schema
 */
export function getOrganizationSchema() {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "Codeaxys",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      "@id": `${SITE_URL}/#logo`,
      url: LOGO_URL,
      caption: "Codeaxys Logo",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: SUPPORT_EMAIL,
    },
  };
}

/**
 * 2. WebSite Schema (main marketing website)
 */
export function getWebSiteSchema() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: "Codeaxys",
    description: "AI Website Builder, Generator & Marketing Suite",
    publisher: {
      "@id": ORGANIZATION_ID,
    },
    inLanguage: "en-US",
  };
}

/**
 * 3. SoftwareApplication Schema (verified features only)
 */
export function getSoftwareApplicationSchema() {
  return {
    "@type": "SoftwareApplication",
    "@id": SOFTWARE_APPLICATION_ID,
    name: "Codeaxys AI Website Builder",
    url: SITE_URL,
    applicationCategory: "DesignApplication, BusinessApplication",
    operatingSystem: "All (Web-based)",
    browserRequirements:
      "Requires a modern web browser (Chrome, Firefox, Safari, Edge)",
    description:
      "Codeaxys is an AI-powered website builder that generates, visually edits, and publishes responsive multi-page websites with built-in SEO intelligence, custom domain hosting, and marketing tools.",
    publisher: {
      "@id": ORGANIZATION_ID,
    },
    featureList: [
      "AI Prompt-to-Website Generation",
      "Visual and Conversational AI Section Editing",
      "Responsive Multi-Page Website Templates",
      "One-Click Publishing and Fast Subdomain Hosting",
      "Custom Domain Connection with Automated SSL",
      "Clean HTML and Source Code Export",
      "Basic SEO Essentials (Sitemaps, Robots.txt, Meta Tags)",
      "SEO Command Center and 24/7 Health Monitoring",
      "Answer Engine Optimization (AEO) and AI Search Visibility Tracking",
      "Topical Authority Mapping and AI Content Studio",
      "Competitor Benchmarking and Content Gap Discovery",
      "Autonomous SEO Autopilot with Staged Optimization Fixes",
    ],
  };
}

/**
 * 4. FAQPage Schema generator
 */
export function getFaqSchema(
  items: Array<{ question: string; answer: string }>,
  pageUrl: string
) {
  const faqId = pageUrl === SITE_URL ? `${SITE_URL}/#faq` : `${pageUrl}#faq`;
  return {
    "@type": "FAQPage",
    "@id": faqId,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/**
 * 5. WebPage Schema generator
 */
export function getWebPageSchema({
  url,
  name,
  description,
}: {
  url: string;
  name: string;
  description: string;
}) {
  const webpageId = url === SITE_URL ? `${SITE_URL}/#webpage` : `${url}#webpage`;
  return {
    "@type": "WebPage",
    "@id": webpageId,
    url,
    name,
    description,
    isPartOf: {
      "@id": WEBSITE_ID,
    },
    publisher: {
      "@id": ORGANIZATION_ID,
    },
    inLanguage: "en-US",
  };
}

/**
 * Homepage JSON-LD Graph (https://codeaxys.com)
 */
export function getHomepageStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      getOrganizationSchema(),
      getWebSiteSchema(),
      getSoftwareApplicationSchema(),
      getWebPageSchema({
        url: SITE_URL,
        name: "Codeaxys — AI Website Builder, Generator & Marketing Suite",
        description:
          "Turn your ideas into powerful, responsive websites with Codeaxys. Create, visually edit, optimize with built-in SEO, and publish with custom domains from one intelligent workspace.",
      }),
      getFaqSchema(HOMEPAGE_FAQ_ITEMS, SITE_URL),
    ],
  };
}

/**
 * Pricing Page JSON-LD Graph (https://codeaxys.com/pricing)
 */
export function getPricingStructuredData() {
  const pricingUrl = `${SITE_URL}/pricing`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      getWebPageSchema({
        url: pricingUrl,
        name: "Pricing Plans — Simple & Transparent | Codeaxys",
        description:
          "Explore flexible pricing plans for Codeaxys AI Website Builder. Start with our 10-day free trial. Transparent plans for creators, businesses, and digital agencies.",
      }),
      {
        "@id": SOFTWARE_APPLICATION_ID,
      },
      getFaqSchema(PRICING_FAQ_ITEMS, pricingUrl),
    ],
  };
}

/**
 * Privacy Policy Page JSON-LD Graph (https://codeaxys.com/privacy-policy)
 */
export function getPrivacyPolicyStructuredData() {
  const privacyUrl = `${SITE_URL}/privacy-policy`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      getWebPageSchema({
        url: privacyUrl,
        name: "Privacy Policy | Codeaxys",
        description:
          "Learn how Codeaxys collects, uses, protects, and manages information when you use our AI website builder and marketing services.",
      }),
    ],
  };
}

/**
 * Feature Landing Page Structured Data Generator
 */
export function getFeaturePageStructuredData({
  slug,
  title,
  description,
  faqs,
}: {
  slug: string;
  title: string;
  description: string;
  faqs: Array<{ question: string; answer: string }>;
}) {
  const pageUrl = `${SITE_URL}/features/${slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      getWebPageSchema({
        url: pageUrl,
        name: title,
        description,
      }),
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Features",
            item: `${SITE_URL}/#features`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: title,
            item: pageUrl,
          },
        ],
      },
      {
        "@id": SOFTWARE_APPLICATION_ID,
      },
      getFaqSchema(faqs, pageUrl),
    ],
  };
}
