"use client";

import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";

export default function AdminSubscriptionsPage() {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/subscriptions");
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-12 text-center text-slate-500 font-medium">Loading Subscriptions...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Subscription Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">Overview of customer plans and renewal statuses</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-3.5 px-4 font-bold text-slate-700">User / Owner</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Plan</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Status</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Provider</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Period Start</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Period End</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Cancel at Period End</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No active subscriptions recorded.
                    </td>
                  </tr>
                ) : (
                  subscriptions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{s.owner_name}</td>
                      <td className="py-3 px-4 font-bold text-purple-700 uppercase">{s.plan_id}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold">
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 capitalize">{s.billing_provider}</td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(s.current_period_start)}</td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(s.current_period_end)}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {s.cancel_at_period_end ? "Yes (Ending)" : "No (Auto-Renew)"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
