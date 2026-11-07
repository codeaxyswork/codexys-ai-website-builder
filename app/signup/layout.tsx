import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create an Account",
  description: "Sign up for Codeaxys AI Website Builder and start creating websites with AI.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

