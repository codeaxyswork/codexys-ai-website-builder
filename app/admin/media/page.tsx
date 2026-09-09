"use client";

import React, { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Trash2, ExternalLink } from "lucide-react";

export default function AdminMediaPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/media");
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

  const handleDeleteMedia = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete file "${name}" permanently?`)) return;

    try {
      const res = await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
      if (res.ok) {
        setStatusMsg(`Media file "${name}" deleted permanently.`);
        fetchMedia();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const formatBytes = (bytes: number = 0) => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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
        <div className="p-12 text-center text-slate-500 font-medium">Loading Media Assets...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Media Assets</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage customer uploaded images and media storage</p>
          </div>

          <div className="px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-800 text-xs font-bold">
            Total Storage Used: {formatBytes(data?.totalStorageBytes || 0)} ({data?.totalFiles || 0} Files)
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
                  <th className="py-3.5 px-4 font-bold text-slate-700">File Name</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Owner</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Size</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">MIME Type</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700">Uploaded</th>
                  <th className="py-3.5 px-4 font-bold text-slate-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!data?.media || data.media.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No media assets uploaded yet.
                    </td>
                  </tr>
                ) : (
                  data.media.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 truncate max-w-[200px]">{m.file_name}</td>
                      <td className="py-3 px-4 text-slate-700">{m.owner_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-800">{formatBytes(m.file_size_bytes)}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono">{m.mime_type}</td>
                      <td className="py-3 px-4 text-slate-400">{formatDate(m.created_at)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {m.public_url && (
                            <a
                              href={m.public_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-purple-600 hover:bg-purple-50 transition-all"
                              title="View File"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteMedia(m.id, m.file_name)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                            title="Delete Media File"
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
