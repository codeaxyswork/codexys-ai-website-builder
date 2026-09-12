"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { SaveStatus, SaveState } from "@/components/SaveStatus";
import {
  PlusCircle,
  RefreshCw,
  Download,
  Edit3,
  PanelRightOpen,
  PanelRightClose,
  LayoutDashboard,
  LogIn,
  Sparkles,
  ArrowRight,
} from "lucide-react";

interface HeaderProps {
  onNewProject: () => void;
  onEditPrompt: () => void;
  onRegenerate: () => void;
  isGenerating: boolean;
  hasFiles: boolean;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  websiteId?: string | null;
  isPublished?: boolean;
  publishedSlug?: string | null;
  saveState?: SaveState;
  onPublishStatusChange?: (published: boolean, slug: string | null) => void;
}

export function Header({
  onNewProject,
  onEditPrompt,
  onRegenerate,
  isGenerating,
  hasFiles,
  isSidebarOpen,
  onToggleSidebar,
  websiteId = null,
  isPublished = false,
  publishedSlug = null,
  saveState = "idle",
  onPublishStatusChange,
}: HeaderProps) {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }: { data: any }) => {
        setUser(data?.user || null);
      });

      const { data: listener } = supabase.auth.onAuthStateChange((_: any, session: any) => {
        setUser(session?.user || null);
      });

      return () => {
        listener.subscription.unsubscribe();
      };
    } catch (e) {
      // Supabase not yet configured or error
    }
  }, []);

  const scrollToSection = (id: string) => {
    if (typeof window === "undefined") return;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between z-30 shrink-0 sticky top-0 shadow-2xs">
      {/* Left: Brand Logo & Title */}
      <div className="flex items-center gap-6">
        <button
          onClick={onNewProject}
          className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
        >
          {/* Codexys Logo */}
          <div className="py-1 transition-transform group-hover:scale-105 duration-200">
            <img
              src="/logo.png"
              alt="Codexys AI Logo"
              className="h-6 sm:h-7 w-auto object-contain"
            />
          </div>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          <div className="hidden sm:flex items-center gap-2">
            <h1 className="font-bold text-slate-900 text-sm tracking-tight">
              AI Website Builder
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase rounded-md bg-purple-50 text-purple-700 border border-purple-200">
              PRO
            </span>
          </div>
        </button>

        {/* Landing Mode Desktop Navigation */}
        {!hasFiles && (
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 pl-4 border-l border-slate-200">
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="hover:text-purple-600 transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection("features")}
              className="hover:text-purple-600 transition-colors cursor-pointer"
            >
              Features
            </button>
            <Link href="/pricing" className="hover:text-purple-600 transition-colors">
              Pricing
            </Link>
          </nav>
        )}

        {/* Save Status Indicator (Workspace Mode) */}
        {hasFiles && saveState !== "idle" && (
          <div className="hidden md:block">
            <SaveStatus state={saveState} />
          </div>
        )}
      </div>

      {/* Right Actions Header Bar */}
      <div className="flex items-center gap-3">
        {hasFiles ? (
          /* Workspace Mode Toolbar */
          <>
            <button
              onClick={onNewProject}
              disabled={isGenerating}
              title="Start a new website project"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden sm:inline">New Project</span>
            </button>

            <button
              onClick={onEditPrompt}
              disabled={isGenerating}
              title="Edit initial prompt"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-purple-600" />
              <span>Edit Prompt</span>
            </button>

            <button
              onClick={onRegenerate}
              disabled={isGenerating}
              title="Regenerate website with current prompt"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-purple-600 ${isGenerating ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Regenerate</span>
            </button>


            {/* Sidebar Toggle */}
            <button
              onClick={onToggleSidebar}
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all ml-1 cursor-pointer"
            >
              {isSidebarOpen ? (
                <PanelRightClose className="w-4 h-4 text-purple-600" />
              ) : (
                <PanelRightOpen className="w-4 h-4 text-purple-600" />
              )}
            </button>
          </>
        ) : (
          /* Landing Mode Navigation Actions */
          <>
            {user ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-xs font-bold text-purple-700 transition-all"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-purple-600" />
                <span>Dashboard</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all"
              >
                <LogIn className="w-3.5 h-3.5 text-purple-600" />
                <span>Sign In</span>
              </Link>
            )}

            <button
              onClick={() => scrollToSection("hero-generator")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-700 active:scale-95 transition-all shadow-sm shadow-purple-600/20 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Start Building</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
