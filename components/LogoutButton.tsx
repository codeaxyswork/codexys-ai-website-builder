"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { LogOut, Loader2 } from "lucide-react";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error("Signout error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 hover:text-slate-900 transition-all disabled:opacity-50 shadow-2xs"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
      ) : (
        <LogOut className="w-3.5 h-3.5 text-purple-600" />
      )}
      <span>Logout</span>
    </button>
  );
}
