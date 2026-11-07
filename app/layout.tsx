import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://codeaxys.com"),
  title: {
    default: "Codeaxys — AI Website Builder, Generator & Marketing Suite",
    template: "%s | Codeaxys",
  },
  description:
    "Turn your ideas into powerful, responsive websites with Codeaxys. Create, visually edit, optimize with built-in SEO, and publish with custom domains from one intelligent workspace.",
  keywords: [
    "AI Website Builder",
    "AI Website Generator",
    "Codeaxys",
    "Text to Website",
    "No-Code Website Builder",
    "AI SEO Builder",
    "Responsive Website Generator",
    "Automated Website Creation",
  ],
  authors: [{ name: "Codeaxys" }],
  creator: "Codeaxys",
  publisher: "Codeaxys",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Codeaxys — AI Website Builder, Generator & Marketing Suite",
    description:
      "Turn your ideas into powerful, responsive websites with Codeaxys. Create, visually edit, optimize with built-in SEO, and publish with custom domains from one intelligent workspace.",
    url: "https://codeaxys.com",
    siteName: "Codeaxys",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 878,
        height: 160,
        alt: "Codeaxys — AI Website Builder, Generator & Marketing Suite",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Codeaxys — AI Website Builder, Generator & Marketing Suite",
    description:
      "Turn your ideas into powerful, responsive websites with Codeaxys. Create, visually edit, optimize with built-in SEO, and publish with custom domains from one intelligent workspace.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <GoogleAnalytics />
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
