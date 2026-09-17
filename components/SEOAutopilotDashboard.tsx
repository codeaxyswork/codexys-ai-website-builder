'use me';
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Play,
  Pause,
  CheckCircle2,
  RotateCw,
  Clock,
  ShieldCheck,
  Sliders,
  AlertCircle,
} from 'lucide-react';
import { SEOAutopilotSettings, SEOAutopilotActivity } from '@/lib/seo-opportunities/types';

interface SEOAutopilotDashboardProps {
  websiteId: string;
}

export default function SEOAutopilotDashboard({ websiteId }: SEOAutopilotDashboardProps) {
  const [settings, setSettings] = useState<SEOAutopilotSettings | null>(null);
  const [activities, setActivities] = useState<SEOAutopilotActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningCycle, setRunningCycle] = useState(false);

  const fetchAutopilotData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/autopilot`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error('Failed to load autopilot data:', err);
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    fetchAutopilotData();
  }, [fetchAutopilotData]);

  const handleToggleStatus = async () => {
    if (!settings) return;
    const newStatus = settings.status === 'active' ? 'paused' : 'active';
    setSettings((prev) => (prev ? { ...prev, status: newStatus } : null));

    try {
      await fetch(`/api/websites/${websiteId}/seo/autopilot`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/autopilot`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scan_frequency: settings.scan_frequency,
          auto_stage_safe_fixes: settings.auto_stage_safe_fixes,
          notify_on_critical: settings.notify_on_critical,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRunCycleNow = async () => {
    setRunningCycle(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/autopilot`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchAutopilotData();
      }
    } catch (err) {
      console.error('Failed to trigger cycle:', err);
    } finally {
      setRunningCycle(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center font-sans">
        <RotateCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-600">Loading SEO Autopilot Configuration...</p>
      </div>
    );
  }

  const isAutopilotActive = settings?.status === 'active';

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner & Main Mode Switch */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">SEO Autopilot Engine</h2>
            <span
              className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                isAutopilotActive
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              {isAutopilotActive ? 'AUTOPILOT ACTIVE' : 'AUTOPILOT PAUSED'}
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium">
            Automated SEO health checks, safe fix staging, and continuous search performance monitoring.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunCycleNow}
            disabled={runningCycle}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${runningCycle ? 'animate-spin' : ''}`} />
            {runningCycle ? 'Running Cycle...' : 'Run Cycle Now'}
          </button>

          <button
            onClick={handleToggleStatus}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-xs transition-colors cursor-pointer ${
              isAutopilotActive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isAutopilotActive ? (
              <>
                <Pause className="w-4 h-4" /> Pause Autopilot
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Activate Autopilot
              </>
            )}
          </button>
        </div>
      </div>

      {/* Autopilot Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scan Frequency</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-slate-900 capitalize">{settings?.scan_frequency}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Last Run</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-sm font-bold text-slate-900">
              {settings?.last_scanned_at ? new Date(settings.last_scanned_at).toLocaleDateString() : 'Never'}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Next Scheduled Scan</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-sm font-bold text-purple-700">
              {settings?.next_scan_at ? new Date(settings.next_scan_at).toLocaleDateString() : 'Pending Activation'}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fix Execution Safety</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg">
              {settings?.auto_stage_safe_fixes ? 'Staging Review First' : 'Immediate Staging'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Settings Form & Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-purple-600" />
              Autopilot Controls & Safety Policies
            </h3>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>

          {/* Schedule settings */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-1">Autonomous Scan Frequency</label>
              <select
                value={settings?.scan_frequency || 'weekly'}
                onChange={(e) =>
                  setSettings(prev => prev ? ({ ...prev, scan_frequency: e.target.value as any }) : null)
                }
                className="w-full max-w-xs px-3.5 py-2 border border-slate-200/90 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
              >
                <option value="daily">Daily Scans</option>
                <option value="weekly">Weekly Scans</option>
                <option value="monthly">Monthly Scans</option>
              </select>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Autopilot scans your site pages, GSC records, and technical tags automatically at this interval.
              </p>
            </div>

            {/* Safety policy toggles */}
            <div className="pt-2 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings?.auto_stage_safe_fixes ?? true}
                  onChange={(e) =>
                    setSettings(prev => prev ? ({ ...prev, auto_stage_safe_fixes: e.target.checked }) : null)
                  }
                  className="mt-0.5 w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                />
                <div>
                  <span className="text-sm font-bold text-slate-900">
                    Auto-Stage Low-Risk Recommendations (Recommended)
                  </span>
                  <p className="text-xs text-slate-500 font-medium">
                    Pre-stage detected fixes into your review list before modifying production content.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings?.notify_on_critical ?? true}
                  onChange={(e) =>
                    setSettings(prev => prev ? ({ ...prev, notify_on_critical: e.target.checked }) : null)
                  }
                  className="mt-0.5 w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                />
                <div>
                  <span className="text-sm font-bold text-slate-900">
                    Notify on Critical Issues
                  </span>
                  <p className="text-xs text-slate-500 font-medium">
                    Trigger high-priority alerts whenever critical issues (score drop, broken links) are detected.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Safety & System Guardrails Info Card */}
        <div className="bg-gradient-to-br from-purple-50/80 to-indigo-50/60 border border-purple-100 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-purple-700 font-bold text-sm uppercase tracking-wider">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            Safety Guardrails
          </div>
          <p className="text-xs text-slate-700 font-medium leading-relaxed">
            Codeaxys Autopilot operates with strict safety boundaries to protect site integrity and layout:
          </p>
          <ul className="space-y-2.5 text-xs text-slate-700 font-medium">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Zero destructive page deletions or URL slug changes without user approval.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Fixes are logged with before/after state history for instant one-click rollback.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Deterministic zero-credit scanning engine keeps AI credit consumption controlled.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Autopilot Activity Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-600" />
          Autopilot Activity Audit Log
        </h3>

        {activities.length === 0 ? (
          <p className="text-sm text-slate-500 font-medium italic">
            No Autopilot actions logged yet. Run a manual cycle or activate scheduled scans.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {activities.map((act) => (
              <div key={act.id} className="py-3.5 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 capitalize">{act.event_type.replace('_', ' ')}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800">
                      Logged
                    </span>
                  </div>
                  <p className="text-slate-600 font-medium">{act.details || act.title}</p>
                </div>

                <div className="text-right text-slate-400 font-medium whitespace-nowrap">
                  {new Date(act.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
