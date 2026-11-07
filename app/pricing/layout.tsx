import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing Plans — Simple & Transparent",
  description:
    "Explore flexible pricing plans for Codeaxys AI Website Builder. Start with our 10-day free trial. Transparent plans for creators, businesses, and digital agencies.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Pricing Plans — Codeaxys AI Website Builder & Marketing Suite",
    description:
      "Explore flexible pricing plans for Codeaxys AI Website Builder. Start with our 10-day free trial. Transparent plans for creators, businesses, and digital agencies.",
    url: "https://codeaxys.com/pricing",
    siteName: "Codeaxys",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 878,
        height: 160,
        alt: "Codeaxys Pricing Plans",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing Plans — Codeaxys AI Website Builder & Marketing Suite",
    description:
      "Explore flexible pricing plans for Codeaxys AI Website Builder. Start with our 10-day free trial.",
    images: ["/logo.png"],
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

