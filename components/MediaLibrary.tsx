"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Copy,
  Check,
  HardDrive,
  AlertTriangle,
  Loader2,
  FileImage,
  ExternalLink,
  Plus,
} from "lucide-react";
import { UserUsageData } from "@/lib/billing";

export interface MediaAssetItem {
  id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  public_url: string;
  created_at: string;
}

interface MediaLibraryProps {
  initialAssets: MediaAssetItem[];
  usage: UserUsageData;
}

export function MediaLibrary({ initialAssets, usage }: MediaLibraryProps) {
  const [assets, setAssets] = useState<MediaAssetItem[]>(initialAssets);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    if (mb < 1000) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  const totalUsedBytes = assets.reduce(
    (sum, item) => sum + (Number(item.file_size_bytes) || 0),
    0
  );
  const storageLimitBytes = usage.storage.limitBytes;
  const storagePercentage = Math.min(
    100,
    Math.round((totalUsedBytes / storageLimitBytes) * 100)
  );

  const handleFileSelect = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setUploadError(null);

    // Validate size client-side (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size exceeds maximum limit of 5 MB.");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setUploadError(data.message || data.error || "Failed to upload image.");
        setIsUploading(false);
        return;
      }

      if (data.asset) {
        setAssets((prev) => [data.asset, ...prev]);
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError("An error occurred during upload.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId || isDeleting) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/media/${deleteTargetId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setAssets((prev) => prev.filter((a) => a.id !== deleteTargetId));
        setDeleteTargetId(null);
      }
    } catch (e) {
      console.error("Delete error:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Storage Quota Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
            <HardDrive className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Storage Usage
            </h2>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-extrabold text-slate-900">
                {formatBytes(totalUsedBytes)}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                / {formatBytes(storageLimitBytes)} Used ({storagePercentage}%)
              </span>
            </div>
            <div className="w-48 bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-purple-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${storagePercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Upload Trigger Button */}
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileSelect(e.target.files)}
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-purple-600 hover:bg-purple-700 active:scale-95 transition-all shadow-md shadow-purple-600/20 flex items-center gap-2 disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Upload New Asset</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {uploadError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="font-medium">{uploadError}</p>
        </div>
      )}

      {/* Assets Grid */}
      {assets.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center flex flex-col items-center justify-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center mb-4">
            <FileImage className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight mb-1">
            No Uploaded Media Assets
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
            Upload custom logos, hero banners, and website graphics (JPEG, PNG, WebP, SVG up to 5 MB).
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-purple-600 hover:bg-purple-700 active:scale-95 transition-all shadow-md shadow-purple-600/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Your First Image</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              {/* Image Preview Container */}
              <div className="h-36 bg-slate-100 relative overflow-hidden flex items-center justify-center p-2">
                {asset.public_url ? (
                  <img
                    src={asset.public_url}
                    alt={asset.file_name}
                    className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-200"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                )}
              </div>

              {/* Asset Info & Action Bar */}
              <div className="p-3 bg-white flex flex-col gap-2">
                <div>
                  <h4 className="font-semibold text-slate-900 text-xs line-clamp-1" title={asset.file_name}>
                    {asset.file_name}
                  </h4>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    {formatBytes(asset.file_size_bytes)} • {formatDate(asset.created_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleCopyUrl(asset.public_url, asset.id)}
                    title="Copy Public Image URL"
                    className="flex-1 py-1 px-2 rounded-lg bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-200 text-slate-700 hover:text-purple-700 text-[11px] font-semibold transition-all flex items-center justify-center gap-1"
                  >
                    {copiedId === asset.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-purple-600" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setDeleteTargetId(asset.id)}
                    title="Delete Image"
                    className="p-1 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Asset Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Delete Media Asset?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  This image file will be permanently deleted from your cloud storage.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTargetId(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Image</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
