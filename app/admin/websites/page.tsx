"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/AdminLayout";
import { Globe, Trash2, ExternalLink, Send } from "lucide-react";

export default function AdminWebsitesPage() {
  const [loading, setLoading] = useState(true);
  const [websites, setWebsites] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchWebsites();
  }, []);

  const fetchWebsites = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/websites");
      if (res.ok) {
        const data = await res.json();
        setWebsites(data.websites || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async (id: string) => {
    if (!confirm("Are you sure you want to unpublish this website?")) return;
    try {
      const res = await fetch(`/api/admin/websites/${id}`, { method: "POST" });
      if (res.ok) {
        setStatusMsg("Website unpublished.");
        fetchWebsites();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}" permanently?`)) return;
    try {
      const res = await fetch(`/api/admin/websites/${id}`, { method: "DELETE" });
      if (res.ok) {
        setStatusMsg("Website deleted permanently.");
        fetchWebsites();
      }
    } catch (e) {
      console.error(e);
    }
  };

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

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-12 text-center text-slate-500 font-medium">Loading Websites...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Websites</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage all customer AI-generated and published websites</p>
          </div>
        </div>

        {statusMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex justify-between items-center">
            <span>{statusMsg}</span>
            <button onClick={() => setStatusMsg(null)} className="font-bold">×</button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-3.5 px-4 font-bold text-slate-700">Website Title</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Owner</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Status</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Published URL</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Created</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {websites.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No websites generated on the platform yet.
                    </td>
                  </tr>
                ) : (
                  websites.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{w.title}</td>
                      <td className="py-3 px-4 text-slate-700">{w.owner_name}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          w.is_published ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {w.is_published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-purple-700">
                        {w.is_published && w.published_slug ? `/site/${w.published_slug}` : "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{formatDate(w.created_at)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {w.is_published && (
                            <>
                              <a
                                href={`/site/${w.published_slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-purple-600 hover:bg-purple-50 transition-all"
                                title="Open Published Website"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => handleUnpublish(w.id)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-amber-700 transition-all"
                                title="Unpublish Website"
                              >
                                <Send className="w-3.5 h-3.5 text-amber-600" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(w.id, w.title)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                            title="Delete Website"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
