import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Wand2, LayoutDashboard, Image as ImageIcon, ArrowLeft } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { MediaLibrary, MediaAssetItem } from "@/components/MediaLibrary";
import { getUserUsage } from "@/lib/billing";

export default async function MediaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch uploaded media assets
  const { data: dbAssets } = await supabase
    .from("media_assets")
    .select("id, file_name, file_size_bytes, mime_type, storage_path, public_url, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch user usage metrics for storage quota checks
  const usageData = (await getUserUsage(user.id)) || {
    plan: { id: "free", name: "Free", allow_custom_domain: false, allow_advanced_seo: false },
    credits: { balance: 50, monthlyUsed: 0, lifetimeUsed: 0, limit: 50 },
    websites: { used: 0, limit: 1 },
    storage: { usedBytes: 0, limitBytes: 104857600 },
  };

  const assets: MediaAssetItem[] = (dbAssets || []).map((a) => ({
    id: a.id,
    file_name: a.file_name,
    file_size_bytes: Number(a.file_size_bytes) || 0,
    mime_type: a.mime_type,
    storage_path: a.storage_path,
    public_url: a.public_url || "",
    created_at: a.created_at,
  }));

  return (
    <div className="min-h-screen w-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      {/* Light Header Bar */}
      <header className="h-16 border-b border-slate-200 bg-white px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="/logo.png" alt="codeaxys logo" className="h-8 w-auto object-contain" />
          </Link>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-medium">
            <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
            <span>Media Library</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-all shadow-2xs"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Launch AI Generator</span>
          </Link>

          <LogoutButton />
        </div>
      </header>

      {/* Main Media Library Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/dashboard" className="text-xs font-medium text-purple-600 hover:underline flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" />
                Back to Dashboard
              </Link>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Customer Media Library
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              Upload, manage, and copy public URLs for custom logo and hero images.
            </p>
          </div>
        </div>

        {/* Media Asset List & Upload Component */}
        <MediaLibrary initialAssets={assets} usage={usageData} />
      </main>
    </div>
  );
}
