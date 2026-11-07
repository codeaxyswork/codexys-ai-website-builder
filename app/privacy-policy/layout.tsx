import type { Metadata } from "next";
import { getPrivacyPolicyStructuredData } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Codeaxys collects, uses, protects, and manages information when you use our AI website builder and marketing services.",
  alternates: {
    canonical: "/privacy-policy",
  },
  openGraph: {
    title: "Privacy Policy | Codeaxys",
    description:
      "Learn how Codeaxys collects, uses, protects, and manages information when you use our AI website builder and marketing services.",
    url: "https://codeaxys.com/privacy-policy",
    siteName: "Codeaxys",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 878,
        height: 160,
        alt: "Codeaxys Privacy Policy",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Privacy Policy | Codeaxys",
    description:
      "Learn how Codeaxys collects, uses, protects, and manages information when you use our AI website builder and marketing services.",
    images: ["/logo.png"],
  },
};

export default function PrivacyPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const privacyStructuredData = getPrivacyPolicyStructuredData();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(privacyStructuredData),
        }}
      />
      {children}
    </>
  );
}
