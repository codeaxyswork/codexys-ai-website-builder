"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/AdminLayout";
import { Search, Filter, ShieldAlert, Sparkles, UserCheck, UserX, MoreVertical } from "lucide-react";

export default function AdminUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  // Credit adjustment modal
  const [creditModalUser, setCreditModalUser] = useState<any | null>(null);
  const [creditAmount, setCreditAmount] = useState<number>(100);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/users");
      if (res.status === 403 || res.status === 401) {
        router.push("/dashboard");
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Fetch admin users error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (user: any) => {
    const newStatus = user.status === "suspended" ? "active" : "suspended";
    if (!confirm(`Are you sure you want to set status for ${user.full_name} to ${newStatus.toUpperCase()}?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_status", status: newStatus }),
      });
      if (res.ok) {
        setStatusMsg(`User status updated to ${newStatus}.`);
        fetchUsers();
      }
    } catch (e) {
      console.error("Toggle status error:", e);
    }
  };

  const handleAddCreditsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditModalUser || creditAmount <= 0) return;

    try {
      setIsAdjusting(true);
      const res = await fetch(`/api/admin/users/${creditModalUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adjust_credits", amount: creditAmount, type: "add" }),
      });
      if (res.ok) {
        setStatusMsg(`Added +${creditAmount} credits to ${creditModalUser.full_name}.`);
        setCreditModalUser(null);
        fetchUsers();
      }
    } catch (e) {
      console.error("Add credits error:", e);
    } finally {
      setIsAdjusting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPlan = planFilter === "all" || u.plan_id === planFilter;
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    const matchRole = roleFilter === "all" || u.role === roleFilter;

    return matchSearch && matchPlan && matchStatus && matchRole;
  });

  const formatDate = (dateStr: string) => {
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

  const formatBytes = (bytes: number = 0) => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center p-12 text-slate-500 font-medium">
          Loading Users Directory...
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">User Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">View and manage all registered user accounts across the platform</p>
          </div>
        </div>

        {statusMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex justify-between items-center">
            <span>{statusMsg}</span>
            <button onClick={() => setStatusMsg(null)} className="font-bold">×</button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users by name or ID..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none"
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="agency">Agency</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-3.5 px-4 font-bold text-slate-700">User</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Role</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Status</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Plan</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">AI Credits</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Websites</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Storage</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Joined</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      No matching user accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <Link href={`/admin/users/${u.id}`} className="font-bold text-slate-900 hover:text-purple-700 transition-colors">
                          {u.full_name}
                        </Link>
                        <span className="block text-[10px] font-mono text-slate-400 truncate max-w-[150px]">{u.id}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          u.role === "super_admin"
                            ? "bg-purple-100 text-purple-800 border-purple-300"
                            : u.role === "admin"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          u.status === "suspended"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}>
                          {u.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold text-purple-700 uppercase">{u.plan_id}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{u.credits_balance}</td>
                      <td className="py-3 px-4 text-slate-700">{u.website_count}</td>
                      <td className="py-3 px-4 text-slate-500">{formatBytes(u.storage_bytes)}</td>
                      <td className="py-3 px-4 text-slate-400">{formatDate(u.created_at)}</td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setCreditModalUser(u)}
                            className="p-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-all text-xs font-semibold"
                            title="Add AI Credits"
                          >
                            + Credits
                          </button>

                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`p-1.5 rounded-lg border transition-all text-xs font-semibold ${
                              u.status === "suspended"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                            }`}
                            title={u.status === "suspended" ? "Reactivate User" : "Suspend User"}
                          >
                            {u.status === "suspended" ? "Reactivate" : "Suspend"}
                          </button>

                          <Link
                            href={`/admin/users/${u.id}`}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Credits Modal */}
        {creditModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Add AI Credits for {creditModalUser.full_name}
              </h3>
              <p className="text-xs text-slate-500">
                Current Balance: <strong className="text-slate-900">{creditModalUser.credits_balance} credits</strong>
              </p>

              <form onSubmit={handleAddCreditsSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Preset or Custom Amount</label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[50, 100, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCreditAmount(amt)}
                        className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                          creditAmount === amt
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        +{amt} Credits
                      </button>
                    ))}
                  </div>

                  <input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(Number(e.target.value))}
                    min={1}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreditModalUser(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAdjusting || creditAmount <= 0}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all disabled:opacity-50"
                  >
                    {isAdjusting ? "Updating..." : `Add +${creditAmount} Credits`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
