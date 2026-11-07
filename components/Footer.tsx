"use client";

import React from "react";
import Link from "next/link";
import { triggerOpenCookiePreferences } from "@/lib/cookie-consent";

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 py-16 px-6 sm:px-12 border-t border-slate-800">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="space-y-4">
          <img
            src="/logo.png"
            alt="Codeaxys Logo"
            className="h-7 w-auto object-contain brightness-200"
          />
          <p className="text-xs text-slate-400 leading-relaxed font-medium">
            Codeaxys AI Website Builder SaaS. Generate, edit, refine, and publish full web applications with AI.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Product</h4>
          <ul className="space-y-2 text-xs font-medium">
            <li>
              <Link href="/features/ai-website-builder" className="hover:text-white transition-colors">
                AI Website Builder
              </Link>
            </li>
            <li>
              <Link href="/features/visual-editor" className="hover:text-white transition-colors">
                In-Canvas Visual Editor
              </Link>
            </li>
            <li>
              <Link href="/features/website-migration" className="hover:text-white transition-colors">
                Website Migration
              </Link>
            </li>
            <li>
              <Link href="/features/seo-autopilot" className="hover:text-white transition-colors">
                SEO Autopilot
              </Link>
            </li>
            <li>
              <Link href="/features/ai-search-visibility" className="hover:text-white transition-colors">
                AI Search Visibility
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-white transition-colors">
                Pricing
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Resources & Legal</h4>
          <ul className="space-y-2 text-xs font-medium">
            <li>
              <Link href="/privacy-policy" className="hover:text-white transition-colors font-semibold text-purple-400">
                Privacy Policy
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={triggerOpenCookiePreferences}
                className="hover:text-white transition-colors cursor-pointer text-left"
              >
                Cookie Settings
              </button>
            </li>
            <li>
              <a href="mailto:admin@codeaxys.com" className="hover:text-white transition-colors">
                Support Email
              </a>
            </li>
            <li>
              <a href="/llms.txt" className="hover:text-white transition-colors">
                llms.txt (AI Context)
              </a>
            </li>
            <li>
              <span className="text-slate-500">API Documentation</span>
            </li>
            <li>
              <span className="text-slate-500">System Status</span>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Account</h4>
          <ul className="space-y-2 text-xs font-medium">
            <li>
              <Link href="/login" className="hover:text-white transition-colors">
                Sign In
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="hover:text-white transition-colors">
                Customer Dashboard
              </Link>
            </li>
            <li>
              <Link href="/admin" className="hover:text-white transition-colors">
                Admin Panel
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <p>© {new Date().getFullYear()} Codeaxys AI. All rights reserved.</p>
        <p>Powered by Gemini 3.6 Flash Engine</p>
      </div>
    </footer>
  );
}
