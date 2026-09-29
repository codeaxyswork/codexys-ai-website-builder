"use client";

import React from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  ShieldCheck,
  Lock,
  Eye,
  Database,
  Share2,
  Trash2,
  Mail,
  CheckCircle2,
  Globe,
  Bot,
  Megaphone,
} from "lucide-react";

export default function PrivacyPolicyPage() {
  const lastUpdated = "September 29, 2026";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-purple-500 selection:text-white">
      {/* Header Navigation */}
      <Header
        onNewProject={() => {}}
        onEditPrompt={() => {}}
        onRegenerate={() => {}}
        isGenerating={false}
        hasFiles={false}
        isSidebarOpen={false}
        onToggleSidebar={() => {}}
      />

      {/* Hero Banner */}
      <div className="relative border-b border-slate-800/80 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 py-16 px-6 sm:px-12 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto space-y-4 text-center relative z-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold tracking-wide uppercase">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            Codeaxys Platform Governance
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed">
            This Privacy Policy details how Codeaxys collects, processes, protects, and manages data across our AI Website Builder and Codeaxys Marketing Agent services.
          </p>
          <div className="pt-2 text-xs text-slate-500 font-medium">
            Effective Date: {lastUpdated}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-6 sm:px-12 py-16 flex-1 w-full space-y-12">
        {/* Section 1: Introduction */}
        <section className="space-y-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              1. Introduction & Scope
            </h2>
          </div>
          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 font-normal">
            <p>
              Welcome to Codeaxys (&quot;Codeaxys&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). Codeaxys provides an end-to-end web application platform encompassing our AI Website Builder, Visual Customization Suite, Full SEO Intelligence Engine, and Codeaxys Marketing Agent platform accessible via our primary domain at{" "}
              <a href="https://codeaxys.com" className="text-purple-400 underline hover:text-purple-300">
                codeaxys.com
              </a>{" "}
              and associated platform endpoints.
            </p>
            <p>
              This Privacy Policy applies specifically to the data processed by Codeaxys when you register an account, build web applications, upload assets, or integrate third-party services like Meta Advertising platforms. This policy does not apply to third-party services that you choose to connect independently, except to the extent that Codeaxys processes such integrations on your behalf.
            </p>
          </div>
        </section>

        {/* Section 2: Information We Collect */}
        <section className="space-y-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              2. Information We Collect
            </h2>
          </div>
          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 font-normal">
            <p>
              We collect information to provide, secure, and improve our services. The categories of information we collect include:
            </p>
            <ul className="space-y-2 list-none pt-2">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-semibold">Account Information:</strong> Your email address, authentication credentials, account preferences, and subscription plan status upon registration.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-semibold">Website Builder & Content Data:</strong> Prompts, website titles, custom domains, section layouts, text copy, styles, and media uploaded to your workspace.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-semibold">Connected Advertising & Platform Data:</strong> When explicitly connected, metadata regarding Facebook Pages, Meta Advertising Accounts, campaign specifications, ad creatives, budget configurations, and performance insights.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-semibold">Technical & Log Data:</strong> Internet Protocol (IP) addresses, browser type, operating system version, page interaction logs, and security audit timestamps.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Section 3: Meta Marketing API Integration */}
        <section className="space-y-4 bg-purple-950/40 border border-purple-800/60 rounded-2xl p-6 sm:p-8 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                3. Meta / Facebook Services Integration
              </h2>
              <p className="text-xs text-purple-300 font-medium mt-0.5">
                App Name: Codeaxys Marketing Agent (Meta App ID: 1740077973765984)
              </p>
            </div>
          </div>
          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 font-normal">
            <p>
              Codeaxys integrates with Meta Services (including Facebook and Instagram) through our official Developer Application, <strong className="text-white">Codeaxys Marketing Agent</strong> (App ID: <code className="text-purple-300 bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800/60">1740077973765984</code>), to allow platform users to create, preview, manage, and monitor online advertising campaigns.
            </p>
            <p className="font-semibold text-white">
              When you explicitly authorize Codeaxys to connect your Meta Account:
            </p>
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-semibold">Authorized Data Access:</strong> Codeaxys requests OAuth permissions (such as <code className="text-xs bg-slate-800 px-1 rounded text-purple-300">ads_management</code>, <code className="text-xs bg-slate-800 px-1 rounded text-purple-300">ads_read</code>, <code className="text-xs bg-slate-800 px-1 rounded text-purple-300">pages_read_engagement</code>, and <code className="text-xs bg-slate-800 px-1 rounded text-purple-300">pages_show_list</code>) to discover your authorized Facebook Pages and Meta Advertising Accounts.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-semibold">Campaign Management Data:</strong> We process campaign parameters (such as objectives, budget allocations, targeting criteria, ad copy, image assets, and approval snapshots) strictly to execute user-approved campaigns in PAUSED or active states on your selected Meta Ad Account.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-semibold">Token Security:</strong> OAuth access tokens are encrypted at rest using AES-256-GCM authenticated encryption and stored in isolated, server-only storage tables.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-semibold">No Data Selling:</strong> Codeaxys <strong className="text-white">does not sell Meta user data</strong>, does not share Meta advertising data with third-party data brokers, and does not utilize your advertising data to train public AI models.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Section 4: How We Use Information */}
        <section className="space-y-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              4. How We Use Information
            </h2>
          </div>
          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 font-normal">
            <p>Codeaxys uses collected data for the following operational purposes:</p>
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Generating, rendering, hosting, and publishing web applications based on your prompts and configurations.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Executing user-initiated marketing campaign publishing and status synchronization via connected advertising APIs.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Providing SEO intelligence analytics, performance insights, and custom domain routing.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Authenticating user accounts, managing subscriptions, monitoring system usage quotas, and safeguarding platform security.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Section 5: Third-Party Service Providers */}
        <section className="space-y-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              5. Third-Party Service Providers
            </h2>
          </div>
          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 font-normal">
            <p>
              We utilize trusted infrastructure providers to deliver our services. Third-party providers only access information necessary to perform specific platform tasks under strict confidentiality requirements:
            </p>
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2.5">
                <strong className="text-white font-semibold min-w-32">Database & Auth:</strong>
                <span>Supabase (Data persistence, user authentication, and media storage).</span>
              </li>
              <li className="flex items-start gap-2.5">
                <strong className="text-white font-semibold min-w-32">Platform Hosting:</strong>
                <span>Vercel (Global application hosting, SSL/TLS edge deployment, and domain routing).</span>
              </li>
              <li className="flex items-start gap-2.5">
                <strong className="text-white font-semibold min-w-32">AI Engine:</strong>
                <span>Google Gemini API (Generative website planning, content generation, and strategy assistance).</span>
              </li>
              <li className="flex items-start gap-2.5">
                <strong className="text-white font-semibold min-w-32">Advertising API:</strong>
                <span>Meta Graph API (User-directed campaign setup, ad creative deployment, and performance sync).</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Section 6: Data Security */}
        <section className="space-y-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              6. Data Security & Encryption
            </h2>
          </div>
          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 font-normal">
            <p>
              Codeaxys enforces multi-layered security controls to protect platform and user data. All data transmitted between your browser and our servers is encrypted in transit using standard Transport Layer Security (TLS 1.3/HTTPS). OAuth access tokens for integrated platforms like Meta are encrypted at rest using AES-256-GCM. Direct database queries enforce strict Row-Level Security (RLS) policies to prevent unauthorized cross-account access.
            </p>
          </div>
        </section>

        {/* Section 7: Data Retention & Account Deletion */}
        <section className="space-y-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              7. Data Retention & Account Deletion Request Procedure
            </h2>
          </div>
          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 font-normal">
            <p>
              Codeaxys retains account and workspace data as long as your account remains active or as required to fulfill our operational and legal obligations.
            </p>
            <p className="font-semibold text-white">
              How to Disconnect Integrations or Request Full Account Deletion:
            </p>
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-semibold">Disconnecting Meta Services:</strong> You can disconnect your Meta account at any time directly from the Codeaxys Marketing Settings dashboard or by revoking permissions in your Facebook Business Integrations settings.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-semibold">Account & Data Deletion Request:</strong> To request complete deletion of your Codeaxys account, personal data, and all associated connection tokens, send an email from your registered account email address to{" "}
                  <a href="mailto:admin@codeaxys.com" className="text-purple-400 underline font-medium hover:text-purple-300">
                    admin@codeaxys.com
                  </a>{" "}
                  with the subject line <code className="text-xs bg-slate-800 px-1 py-0.5 rounded text-purple-300">&quot;Account Data Deletion Request&quot;</code>.
                </span>
              </li>
            </ul>
            <p className="text-xs text-slate-400 pt-1">
              Upon receipt of your request, Codeaxys will verify your ownership and purge your account data, stored assets, and encrypted OAuth tokens from our primary databases within 30 days.
            </p>
          </div>
        </section>

        {/* Section 8: Your Data Rights */}
        <section className="space-y-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              8. Your Data Rights & Choices
            </h2>
          </div>
          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 font-normal">
            <p>Depending on your geographic location, you may have the right to:</p>
            <ul className="space-y-2 list-none">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>Access and review the personal information associated with your account.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>Correct inaccurate or incomplete profile or website information.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>Revoke third-party OAuth access authorizations at any time.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>Request erasure of your data as outlined in Section 7.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Section 9: Children's Privacy */}
        <section className="space-y-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xs">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            9. Children&apos;s Privacy
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
            Codeaxys services are intended solely for adult professionals, businesses, and individuals aged 18 and older. We do not knowingly collect or solicit personal information from individuals under the age of 18.
          </p>
        </section>

        {/* Section 10: Policy Updates & Contact Information */}
        <section className="space-y-4 bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-900 border border-purple-500/30 rounded-2xl p-6 sm:p-8 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              10. Changes & Contact Information
            </h2>
          </div>
          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-3 font-normal">
            <p>
              Codeaxys may update this Privacy Policy periodically to reflect service enhancements, platform feature updates, or regulatory requirements. We encourage you to review this page periodically. Continued use of Codeaxys following any modifications signifies your acceptance of the updated policy.
            </p>
            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-white">Privacy Team Support Email:</p>
                <a href="mailto:admin@codeaxys.com" className="text-purple-400 font-medium hover:text-purple-300 text-sm">
                  admin@codeaxys.com
                </a>
              </div>
              <Link
                href="/#hero-generator"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-all shadow-md shadow-purple-900/40"
              >
                Back to Codeaxys Home
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Component */}
      <Footer />
    </div>
  );
}
