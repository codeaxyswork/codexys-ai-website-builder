"use client";

import React, { useState, useEffect } from "react";

interface SEOMonitoringDashboardProps {
  websiteId: string;
}

export function SEOMonitoringDashboard({ websiteId }: SEOMonitoringDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchMonitoringData();
  }, [websiteId]);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      // 1. Fetch Monitoring Schedule
      const schedRes = await fetch(`/api/websites/${websiteId}/seo/monitoring`);
      if (schedRes.ok) {
        const schedData = await schedRes.json();
        setSchedule(schedData);
      }

      // 2. Fetch Monitoring Events/Alerts
      const eventsRes = await fetch(`/api/websites/${websiteId}/seo/monitoring/events`);
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData.events || []);
      }
    } catch (err: any) {
      console.error("Fetch monitoring data error:", err);
      setErrorMessage(err.message || "Failed to load monitoring data.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSchedule = async (updates: { enabled?: boolean; frequency?: string }) => {
    try {
      setIsUpdating(true);
      setErrorMessage(null);

      const res = await fetch(`/api/websites/${websiteId}/seo/monitoring`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to update schedule.");
      }

      const updated = await res.json();
      setSchedule(updated);
      setSuccessMessage("Monitoring preferences updated.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error("Update schedule error:", err);
      setErrorMessage(err.message || "Failed to update settings.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRunAuditNow = async () => {
    try {
      setIsRunning(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await fetch(`/api/websites/${websiteId}/seo/monitoring/run`, {
        method: "POST",
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to execute audit.");
      }

      setSuccessMessage("Deterministic SEO monitoring audit completed (0 AI credits).");
      await fetchMonitoringData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Run audit error:", err);
      setErrorMessage(err.message || "Failed to run audit.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/seo/monitoring/events`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });

      if (res.ok) {
        setEvents((prev) => prev.map((e) => ({ ...e, is_read: true })));
      }
    } catch (err) {
      console.error("Mark all read error:", err);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-xs">
        <div className="inline-flex items-center gap-2 font-medium">
          <svg className="animate-spin h-5 w-5 text-purple-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading SEO Monitoring & Scheduled Job Engine...
        </div>
      </div>
    );
  }

  const unreadCount = events.filter((e) => !e.is_read).length;

  return (
    <div className="space-y-8">
      {/* Banner Notifications */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 font-bold">×</button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center justify-between">
          <span>✓ {successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 font-bold">×</button>
        </div>
      )}

      {/* 1. MONITORING CONTROL PANEL */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">SEO Health Monitoring & Scheduled Jobs</h2>
              {schedule?.enabled ? (
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                  ● Monitoring Active
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
                  ○ Monitoring Paused
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Deterministic background audits track score shifts, broken links, NAP consistency, and Search Console traffic drops without consuming AI credits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleUpdateSchedule({ enabled: !schedule?.enabled })}
              disabled={isUpdating}
              className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all ${
                schedule?.enabled
                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600"
              }`}
            >
              {schedule?.enabled ? "Pause Monitoring" : "Resume Monitoring"}
            </button>

            <button
              onClick={handleRunAuditNow}
              disabled={isRunning}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              {isRunning ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Running Audit...</span>
                </>
              ) : (
                <>
                  <span>Run Audit Now</span>
                  <span className="text-[10px] bg-purple-500 px-1.5 py-0.5 rounded font-mono">0 Credits</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Schedule Preferences Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-xs text-slate-500 font-medium">Audit Frequency</span>
            <select
              value={schedule?.frequency || "weekly"}
              onChange={(e) => handleUpdateSchedule({ frequency: e.target.value })}
              disabled={isUpdating}
              className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg p-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="manual">Manual Only</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (Recommended)</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-xs text-slate-500 font-medium">Last Successful Run</span>
            <p className="text-xs font-bold text-slate-900">
              {schedule?.last_successful_run_at
                ? new Date(schedule.last_successful_run_at).toLocaleString()
                : "Never run yet"}
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-xs text-slate-500 font-medium">Next Scheduled Run</span>
            <p className="text-xs font-bold text-slate-900">
              {schedule?.enabled && schedule?.next_run_at
                ? new Date(schedule.next_run_at).toLocaleString()
                : "Monitoring paused"}
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-xs text-slate-500 font-medium">Failure Status</span>
            <p className={`text-xs font-bold ${schedule?.failure_count > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {schedule?.failure_count > 0
                ? `${schedule.failure_count} Error(s) (${schedule.last_error || "Failed"})`
                : "0 Errors / Healthy"}
            </p>
          </div>
        </div>
      </div>

      {/* 2. MONITORING EVENTS / ALERTS TIMELINE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-slate-900">Monitoring Alerts & Change Events</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                {unreadCount} Unread
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-purple-600 hover:text-purple-800 font-semibold"
            >
              Mark all as read
            </button>
          )}
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
            <span className="text-2xl">🔔</span>
            <p className="text-xs font-bold text-slate-700">No monitoring alerts detected yet.</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Your website structure, canonical tags, robots directives, internal links, and Local SEO are consistent. Click "Run Audit Now" above to check current health.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((evt) => (
              <div
                key={evt.id}
                className={`p-4 rounded-xl border transition-all ${
                  evt.severity === "critical"
                    ? "bg-rose-50/50 border-rose-200"
                    : evt.severity === "warning"
                    ? "bg-amber-50/50 border-amber-200"
                    : "bg-slate-50 border-slate-200"
                } ${!evt.is_read ? "ring-2 ring-purple-400 ring-offset-1" : ""}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${
                        evt.severity === "critical"
                          ? "bg-rose-600 text-white"
                          : evt.severity === "warning"
                          ? "bg-amber-500 text-white"
                          : "bg-blue-600 text-white"
                      }`}
                    >
                      {evt.severity}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{evt.title}</h4>
                    {evt.affected_page && (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-mono text-[10px] rounded">
                        {evt.affected_page}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {new Date(evt.created_at).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-2">{evt.message}</p>

                {(evt.previous_value || evt.current_value) && (
                  <div className="mt-3 flex items-center gap-4 text-xs font-mono bg-white/80 p-2 rounded border border-slate-200/80 w-fit">
                    <span className="text-slate-500">
                      Previous: <strong className="text-slate-800">{evt.previous_value || "N/A"}</strong>
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="text-slate-500">
                      Current: <strong className="text-slate-800">{evt.current_value || "N/A"}</strong>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
