"use client";

import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";

export default function AdminTransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/transactions");
      if (res.ok) {
        const json = await res.json();
        setTransactions(json.transactions || []);
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
        <div className="p-12 text-center text-slate-500 font-medium">Loading Billing Transactions...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Billing Transactions</h1>
            <p className="text-xs text-slate-500 mt-0.5">Log of all subscription upgrades, plan changes, and mock transactions</p>
          </div>

          <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold">
            🧪 Test Mode Active (Mock Transactions)
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-3.5 px-4 font-bold text-slate-700">Date</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Customer</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Plan</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Transaction Type</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Amount</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Provider</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Status</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Payment ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No billing transactions logged yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-500">{formatDate(tx.created_at)}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{tx.owner_name}</td>
                      <td className="py-3 px-4 font-bold text-purple-700 uppercase">{tx.plan_id}</td>
                      <td className="py-3 px-4 text-slate-700 capitalize">{tx.transaction_type.replace(/_/g, " ")}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">₹{tx.amount}</td>
                      <td className="py-3 px-4 capitalize font-medium text-slate-600">{tx.provider} (Test)</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold">
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{tx.provider_payment_id || tx.id.substring(0, 10)}</td>
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
