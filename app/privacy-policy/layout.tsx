import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Codeaxys",
  description:
    "Learn how Codeaxys collects, uses, protects, and manages information when you use our AI website builder and marketing services.",
};

export default function PrivacyPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
