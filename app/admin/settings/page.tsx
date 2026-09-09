"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import {
  Settings,
  Shield,
  Sparkles,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Mail,
  Sliders,
  AlertCircle,
  Cpu,
  Eye,
  EyeOff,
} from "lucide-react";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [appName, setAppName] = useState("Codexys AI Website Builder");
  const [supportEmail, setSupportEmail] = useState("support@codexys.site");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");

  const [aiInfo, setAiInfo] = useState<{
    status: string;
    primaryModel: string;
    fallbackChain: string;
  } | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) {
        throw new Error("Failed to load platform settings.");
      }
      const json = await res.json();
      if (json.settings) {
        setAppName(json.settings.app_name?.name || "Codexys AI Website Builder");
        setSupportEmail(json.settings.support_email?.email || "support@codexys.site");
        setRegistrationEnabled(
          json.settings.registration_enabled?.enabled !== undefined
            ? json.settings.registration_enabled.enabled
            : true
        );
        setMaintenanceMode(json.settings.maintenance_mode?.enabled || false);
        setMaintenanceMessage(json.settings.maintenance_mode?.message || "");
      }
      if (json.aiEngineInfo) {
        setAiInfo(json.aiEngineInfo);
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred fetching settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_name: { name: appName },
          support_email: { email: supportEmail },
          registration_enabled: { enabled: registrationEnabled },
          maintenance_mode: { enabled: maintenanceMode, message: maintenanceMessage },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update settings.");
      }

      setSuccess("Platform settings updated successfully.");
    } catch (err: any) {
      setError(err?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Platform Settings">
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError("")}
            className="text-xs text-red-500 hover:text-red-700 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button
            onClick={() => setSuccess("")}
            className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading system settings...</p>
        </div>
      ) : (
        <form onSubmit={handleSaveSettings} className="space-y-8 max-w-4xl">
          {/* Header Action */}
          <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-600" /> Platform Configuration
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Manage global application settings, registration toggles, maintenance mode, and view AI runtime status.
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-purple-200 hover:shadow-md disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Saving Changes...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Settings
                </>
              )}
            </button>
          </div>

          {/* Maintenance Mode & Controls */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Maintenance & Access Control
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Toggle maintenance mode and public user registrations.
              </p>
            </div>

            {/* Maintenance Mode Toggle */}
            <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 text-sm">Platform Maintenance Mode</span>
                  {maintenanceMode && (
                    <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-md font-medium">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  When enabled, regular users see a maintenance screen. Admins and Super Admins maintain full access to `/admin` and API routes.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {maintenanceMode && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Custom Maintenance Message</label>
                <input
                  type="text"
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  placeholder="We're currently performing maintenance. Please check back soon."
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                />
              </div>
            )}

            {/* Registration Enabled Toggle */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 text-sm">Public Registration</span>
                  {!registrationEnabled && (
                    <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-md font-medium">
                      DISABLED
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Allow new users to sign up for accounts. If disabled, new user signups are restricted.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={registrationEnabled}
                  onChange={(e) => setRegistrationEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>

          {/* Application Metadata */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-600" /> Application Details
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                General information displayed in platform communications.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Application Name</label>
                <input
                  type="text"
                  required
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Support Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="w-full text-sm pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* AI Engine Diagnostics (Safe Read-Only Display) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" /> AI Generation Engine Diagnostics
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Safe runtime metrics for AI core systems. Secrets and API keys are never exposed.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-medium text-slate-500">Gemini Engine Status</p>
                <p className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {aiInfo?.status || "Active"}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-medium text-slate-500">Primary Model</p>
                <p className="text-base font-bold text-purple-700 font-mono mt-1">
                  {aiInfo?.primaryModel || "gemini-3.6-flash"}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-medium text-slate-500">Fallback Chain Status</p>
                <p className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600" /> {aiInfo?.fallbackChain || "Enabled"}
                </p>
              </div>
            </div>

            <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100 text-xs text-purple-900 flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                <strong>Security Protection:</strong> Environment secrets, Supabase Service Role keys, and Gemini API credentials are securely managed server-side and shielded from client exposure.
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-all shadow-sm hover:shadow-purple-200 hover:shadow-md disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Saving Changes...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Platform Settings
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </AdminLayout>
  );
}
