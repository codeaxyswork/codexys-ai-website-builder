import Link from "next/link";
import { Wrench, ShieldCheck, ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function MaintenancePage() {
  const supabase = await createClient();
  const { data: setting } = await supabase
    .from("platform_settings")
    .select("setting_value")
    .eq("setting_key", "maintenance_mode")
    .single();

  const customMessage =
    setting?.setting_value?.message ||
    "We're currently performing scheduled maintenance to upgrade our infrastructure. Please check back soon.";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-purple-100 border border-purple-200 text-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <Wrench className="w-8 h-8 animate-bounce" />
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold rounded-full uppercase tracking-wider mb-3">
            System Maintenance Active
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Under Scheduled Maintenance
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            {customMessage}
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-3 text-xs text-slate-500">
          <p className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Administrative Access Remains Active
          </p>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-700 font-semibold hover:underline"
          >
            Admin Sign In / Control Panel <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
