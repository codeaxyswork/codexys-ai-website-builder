"use client";

import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";

export default function AdminCreditsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/credits");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
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
        <div className="p-12 text-center text-slate-500 font-medium">Loading Credit Logs...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Credits Analytics</h1>
            <p className="text-xs text-slate-500 mt-0.5">Platform-wide credit balance & consumption audit log</p>
          </div>

          <div className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-xl text-purple-800 text-xs font-bold">
            Total Remaining Balance Across Users: {(data?.totalRemainingCredits || 0).toLocaleString()} Credits
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-3.5 px-4 font-bold text-slate-700">Date</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">User</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Action Type</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700 text-right">Credits Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!data?.transactions || data.transactions.length === 0) ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      No AI credit activity logged yet.
                    </td>
                  </tr>
                ) : (
                  data.transactions.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-500">{formatDate(tx.created_at)}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{tx.user_name}</td>
                      <td className="py-3 px-4 font-medium text-slate-700 capitalize">{tx.action_type.replace(/_/g, " ")}</td>
                      <td className={`py-3 px-4 text-right font-bold ${tx.credits_used < 0 ? "text-emerald-600" : "text-purple-700"}`}>
                        {tx.credits_used < 0 ? `+${Math.abs(tx.credits_used)}` : `-${tx.credits_used}`}
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
