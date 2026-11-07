import React from "react";
import type { Metadata } from "next";
import { getFeaturePageStructuredData } from "@/lib/schema";
import { FeaturePageLayout } from "@/components/FeaturePageLayout";

const SLUG = "visual-editor";
const TITLE = "In-Canvas Visual Editor — Edit Websites Visually with AI";
const DESCRIPTION =
  "Dual-mode website editor combining direct visual point-and-click customization with AI prompt refinement. Inspect elements, tweak typography and colors, and see changes in real time.";

const FAQS = [
  {
    question: "What is dual-mode editing?",
    answer:
      "Dual-mode editing allows you to customize your website using both direct visual point-and-click controls (colors, fonts, padding, alignment) and conversational AI prompts ('make this headline punchier', 'change this hero to dark mode'). You can switch between them fluidly at any time.",
  },
  {
    question: "Can I edit text directly on the canvas?",
    answer:
      "Yes. Click any text element directly inside the live preview canvas to rewrite headings, update paragraph copy, or modify button labels with immediate visual feedback.",
  },
  {
    question: "Do visual edits update the actual source code?",
    answer:
      "Yes. Unlike legacy visual builders that inject proprietary inline styles or messy wrapper tags, Codeaxys updates clean React component code and Tailwind CSS classes in real time.",
  },
  {
    question: "Can I preview how my changes look on mobile and tablet screens?",
    answer:
      "Yes. The visual editor includes instant viewport switching controls for Desktop, Tablet, and Mobile views so you can verify responsive layouts before publishing.",
  },
  {
    question: "What if I make a mistake while editing?",
    answer:
      "The editor includes non-destructive revision tracking and undo/redo capabilities, allowing you to quickly roll back any unwanted changes with confidence.",
  },
  {
    question: "Do I need coding skills to use the visual editor?",
    answer:
      "Not at all. The visual controls and conversational AI assistant let you customize every visual aspect of your website without writing a single line of CSS or JavaScript.",
  },
];

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "https://codeaxys.com/features/visual-editor",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://codeaxys.com/features/visual-editor",
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

export default function VisualEditorPage() {
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
        featureName="In-Canvas Visual Editor"
        badgeText="Dual-Mode Editing Engine"
        heroHeadline="Point, Click, & Refine"
        heroHeadlineAccent="Visually with AI."
        heroSubheadline="The perfect harmony between visual design controls and conversational AI. Click any element on canvas to tweak styles, rewrite copy, or let AI redesign entire sections on command."
        primaryCtaText="Start Building Free"
        primaryCtaHref="/#hero-generator"
        secondaryCtaText="View Pricing Plans"
        secondaryCtaHref="/pricing"
        trustPoints={[
          "Point-and-click ease",
          "AI prompt refinement",
          "Responsive viewport previews",
          "Zero code required",
        ]}
        explanation={{
          badge: "Dual-Mode Architecture",
          headline: "Visual precision meets conversational intelligence.",
          description:
            "Designers love visual control; developers and founders love the speed of AI. Codeaxys combines both into one unified canvas. Select any element directly on screen to fine-tune spacing, typography, and color schemes, or speak to the AI assistant to execute complex layout restyles across the entire page.",
          highlights: [
            "Direct point-and-click element selection with instant highlight bounding boxes",
            "Conversational AI assistant for macro redesigns and copywriting enhancements",
            "Real-time responsive previews across Desktop, Tablet, and Mobile viewports",
            "Clean React and Tailwind CSS output with zero runtime bloat",
          ],
          callout: {
            title: "Zero Messy Overrides",
            description:
              "Every visual adjustment updates pure Tailwind CSS utility classes and clean React components. When you export or deploy, your code remains clean, elegant, and maintainable.",
          },
        }}
        capabilities={[
          {
            title: "Point-and-Click Selection",
            description:
              "Click any headline, image, container, or button directly on the canvas to inspect its properties and apply instant adjustments.",
            icon: "mousePointer",
            badge: "Instant Focus",
          },
          {
            title: "Conversational AI Copilot",
            description:
              "Instruct the AI assistant to refine specific elements: 'Make this hero bolder', 'Add a price calculator', or 'Swap to a pastel gradient'.",
            icon: "sparkles",
            badge: "AI Copilot",
          },
          {
            title: "Responsive Viewport Switcher",
            description:
              "Toggle instantly between Desktop (1280px), Tablet (768px), and Mobile (375px) viewports to guarantee pixel-perfect responsiveness.",
            icon: "smartphone",
            badge: "Multi-Device",
          },
          {
            title: "Global Style & Theme Controls",
            description:
              "Change your brand's color palette, typography hierarchy, button border radiuses, and spacing systems globally across all pages.",
            icon: "palette",
            badge: "Global Tokens",
          },
          {
            title: "Live Code Split-Inspector",
            description:
              "Developers can open the synchronized code drawer anytime to inspect raw JSX components and verify standard Tailwind classes.",
            icon: "fileCode",
            badge: "Developer Friendly",
          },
          {
            title: "Non-Destructive Revision History",
            description:
              "Experiment freely with complete peace of mind. Revert individual edits or restore previous snapshots with 1-click undo history.",
            icon: "undo",
            badge: "Safe Undo",
          },
        ]}
        workflow={{
          badge: "Intuitive 4-Step Editing",
          headline: "How Visual Editing Works in Codeaxys",
          description:
            "Effortless customization whether you want to make a quick text tweak or a complete section overhaul.",
          steps: [
            {
              stepNumber: "01",
              title: "Click Any Element",
              description:
                "Hover and click on any text block, image, badge, or section to activate its contextual action menu.",
              badge: "Select",
            },
            {
              stepNumber: "02",
              title: "Tweak Visually or Ask AI",
              description:
                "Adjust sliders for spacing and colors, or type a quick AI prompt to rewrite, reformat, or restyle.",
              badge: "Dual-Mode",
            },
            {
              stepNumber: "03",
              title: "Preview Across Devices",
              description:
                "Switch viewports to ensure your changes look stunning on smartphones, tablets, and wide monitors.",
              badge: "Verify",
            },
            {
              stepNumber: "04",
              title: "Publish with 1 Click",
              description:
                "Save your modifications. Changes propagate instantly to your live public website with zero downtime.",
              badge: "Live Deploy",
            },
          ],
        }}
        useCases={{
          badge: "Built for Creators & Teams",
          headline: "Who Uses the Codeaxys Visual Editor?",
          description:
            "From founders perfecting their pitch to agency designers crafting client experiences.",
          personas: [
            {
              title: "Founders & Marketers",
              subtitle: "Iterate Landing Pages Fast",
              icon: "zap",
              description:
                "A/B test headlines, swap call-to-action buttons, update promotional banners, and polish copy without asking engineering for help.",
              points: [
                "Zero dependencies on developers",
                "Instant copy and color updates",
                "Built-in conversion best practices",
              ],
            },
            {
              title: "Designers & Agencies",
              subtitle: "Pixel-Perfect Brand Alignment",
              icon: "palette",
              description:
                "Maintain complete aesthetic control. Customize typography scales, color palettes, and container padding to match client brand guidelines.",
              points: [
                "Global design system tokens",
                "Instant mobile viewport previews",
                "Client-friendly revision workflows",
              ],
            },
            {
              title: "Developers & Engineers",
              subtitle: "No More Spaghetti Code",
              icon: "fileCode",
              description:
                "Enjoy visual editing without compromising on code quality. Inspect generated React code, verify clean Tailwind classes, and export anytime.",
              points: [
                "Real Next.js 15 React components",
                "Standard Tailwind utility classes",
                "Full code export with no lock-in",
              ],
            },
          ],
        }}
        visualShowcase={{
          badge: "Editor Interface Preview",
          headline: "Dual-Mode Canvas in Action",
          description:
            "Direct visual manipulation with an integrated conversational AI copilot and responsive viewports.",
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
            title: "Website Migration & Redesign",
            description:
              "Import an existing website URL to extract assets, content, and structure with an automated modern redesign.",
            href: "/features/website-migration",
            icon: "arrowRightLeft",
            badge: "URL Importer",
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
          badge: "Take Full Control",
          headline: "Design Visually. Build Faster with AI.",
          description:
            "Experience the flexibility of visual editing with the autonomous power of AI on Codeaxys.",
          primaryCtaText: "Start Building Free",
          primaryCtaHref: "/#hero-generator",
          secondaryCtaText: "View Pricing Plans",
          secondaryCtaHref: "/pricing",
        }}
      />
    </>
  );
}
