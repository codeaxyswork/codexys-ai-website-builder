"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/AdminLayout";

interface UserDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default function AdminUserDetailsPage({ params }: UserDetailsPageProps) {
  const { id: userId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchUserDetails();
  }, [userId]);

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/users/${userId}`);
      if (res.status === 403 || res.status === 401) {
        router.push("/dashboard");
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load user details.");

      setData(json);
    } catch (err: any) {
      console.error("Fetch user details error:", err);
      setErrorMsg(err.message || "Failed to load user details.");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionPayload: any) => {
    try {
      setStatusMsg(null);
      setErrorMsg(null);

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actionPayload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed.");

      setStatusMsg(json.message || "Action completed successfully.");
      fetchUserDetails();
    } catch (err: any) {
      console.error("Admin user action error:", err);
      setErrorMsg(err.message || "Action failed.");
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-12 text-center text-slate-500 font-medium">
          Loading User Details...
        </div>
      </AdminLayout>
    );
  }

  const u = data?.user;

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/users" className="text-slate-500 hover:text-slate-900 text-xs font-semibold">
              ← Back to Users
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{u?.full_name || "User Details"}</h1>
              <span className="text-xs font-mono text-slate-400">{u?.id}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
              u?.status === "suspended" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}>
              {u?.status}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
              Role: {u?.role}
            </span>
          </div>
        </div>

        {statusMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex justify-between">
            <span>{statusMsg}</span>
            <button onClick={() => setStatusMsg(null)} className="font-bold">×</button>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="font-bold">×</button>
          </div>
        )}

        {/* Profile & Control Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User Overview Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">
              Account Overview
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Name:</span> <strong className="text-slate-900">{u?.full_name}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Subscription Plan:</span> <strong className="text-purple-700 uppercase font-bold">{u?.subscription?.plan_id}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Credits Remaining:</span> <strong className="text-slate-900 font-bold">{u?.credits?.balance}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Joined Date:</span> <span className="text-slate-600">{formatDate(u?.created_at)}</span></div>
            </div>

            {/* Quick Admin Actions */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quick Controls</h4>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleAction({ action: "adjust_credits", amount: 100, type: "add" })}
                  className="py-2 px-3 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-semibold rounded-lg transition-all"
                >
                  +100 Credits
                </button>
                <button
                  onClick={() => handleAction({ action: "change_status", status: u?.status === "suspended" ? "active" : "suspended" })}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                    u?.status === "suspended" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  {u?.status === "suspended" ? "Reactivate" : "Suspend"}
                </button>
              </div>

              {/* Super Admin Role Control */}
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Role (Super Admin)</label>
                <select
                  value={u?.role || "user"}
                  onChange={(e) => handleAction({ action: "change_role", role: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>
          </div>

          {/* User Saved Websites List */}
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3 mb-4">
              Saved Websites ({data?.websites?.length || 0})
            </h3>

            {data?.websites?.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No saved websites created yet.</p>
            ) : (
              <div className="space-y-3">
                {data?.websites?.map((w: any) => (
                  <div key={w.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <h4 className="font-bold text-slate-900">{w.title}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">Updated {formatDate(w.updated_at)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {w.is_published ? (
                        <a
                          href={`/site/${w.published_slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold text-[10px]"
                        >
                          View Public Site ↗
                        </a>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-200 text-slate-600 rounded-full font-semibold text-[10px]">
                          Draft
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* User Billing & Credit History */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Billing History */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3 mb-4">
              Billing Transactions
            </h3>
            {data?.transactions?.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No billing transactions recorded.</p>
            ) : (
              <div className="space-y-2">
                {data?.transactions?.map((tx: any) => (
                  <div key={tx.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <span className="font-bold text-purple-700 uppercase">{tx.plan_id} Plan</span>
                      <span className="block text-[10px] text-slate-400">{formatDate(tx.created_at)}</span>
                    </div>
                    <span className="font-bold text-slate-900">₹{tx.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Credit Usage Logs */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3 mb-4">
              Recent AI Credit Activity
            </h3>
            {data?.creditLogs?.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No credit activity logged.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {data?.creditLogs?.map((log: any) => (
                  <div key={log.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-slate-800 capitalize">{log.action_type.replace("_", " ")}</span>
                      <span className="block text-[10px] text-slate-400">{formatDate(log.created_at)}</span>
                    </div>
                    <span className={`font-bold ${log.credits_used < 0 ? "text-emerald-600" : "text-purple-600"}`}>
                      {log.credits_used < 0 ? `+${Math.abs(log.credits_used)}` : `-${log.credits_used}`} credits
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
