"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  Globe,
  Eye,
} from "lucide-react";
import { GeneratedFile } from "@/lib/types";
import { assemblePreviewDoc } from "@/lib/preview-helper";

interface LivePreviewProps {
  files: GeneratedFile[];
  isGenerating: boolean;
}

export function LivePreview({ files }: LivePreviewProps) {
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [refreshKey, setRefreshKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Extract HTML files
  const htmlFiles = useMemo(
    () => files.filter((f) => f.path.endsWith(".html") || f.path.endsWith(".htm")),
    [files]
  );
  const [userSelectedPath, setUserSelectedPath] = useState<string | null>(null);

  const activeHtmlPath = useMemo(() => {
    if (userSelectedPath && htmlFiles.some((f) => f.path === userSelectedPath)) {
      return userSelectedPath;
    }
    const idx = htmlFiles.find((f) => f.path.endsWith("index.html"));
    return idx ? idx.path : htmlFiles[0]?.path || "index.html";
  }, [htmlFiles, userSelectedPath]);

  // Listen for internal preview link clicks across multi-page templates
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "CODEAXYS_NAVIGATE_PAGE") {
        const rawPath = String(event.data.path || "").trim();
        if (!rawPath) return;
        const cleanPath = rawPath.split("?")[0].split("#")[0].replace(/^\/+/, "");
        const match = htmlFiles.find((f) => {
          const fClean = f.path.replace(/^\/+/, "");
          return (
            fClean === cleanPath ||
            fClean === `${cleanPath}.html` ||
            fClean.replace(/\.html$/, "") === cleanPath.replace(/\.html$/, "") ||
            fClean.endsWith("/" + cleanPath)
          );
        });
        if (match) {
          setUserSelectedPath(match.path);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [htmlFiles]);

  const activeHtmlContent = useMemo(() => {
    return (
      htmlFiles.find((f) => f.path === activeHtmlPath)?.content ||
      htmlFiles.find((f) => f.path.endsWith("index.html"))?.content ||
      htmlFiles[0]?.content ||
      ""
    );
  }, [htmlFiles, activeHtmlPath]);

  // Extract primary CSS (styles.css, style.css, or any .css file)
  const cssFile = useMemo(() => {
    const primary =
      files.find((f) => f.path.endsWith("styles.css")) ||
      files.find((f) => f.path.endsWith("style.css")) ||
      files.find((f) => f.path.endsWith(".css"));
    return primary?.content || "";
  }, [files]);

  // Extract primary JS (script.js, scripts.js, main.js, app.js, or any .js file)
  const jsFile = useMemo(() => {
    const primary =
      files.find((f) => f.path.endsWith("script.js")) ||
      files.find((f) => f.path.endsWith("scripts.js")) ||
      files.find((f) => f.path.endsWith("main.js")) ||
      files.find((f) => f.path.endsWith("app.js")) ||
      files.find((f) => f.path.endsWith(".js"));
    return primary?.content || "";
  }, [files]);

  // Assemble full standalone HTML for iframe srcDoc
  const assembledSrcDoc = useMemo(() => {
    return assemblePreviewDoc(activeHtmlContent, cssFile, jsFile);
  }, [activeHtmlContent, cssFile, jsFile]);

  const handleOpenNewTab = () => {
    if (!assembledSrcDoc) return;
    const blob = new Blob([assembledSrcDoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const deviceWidths = {
    desktop: "w-full h-full rounded-none border-none shadow-none",
    tablet: "w-[768px] h-[92%] my-auto shadow-xl rounded-2xl border border-slate-300 overflow-hidden",
    mobile: "w-[375px] h-[88%] my-auto shadow-xl rounded-3xl border border-slate-300 overflow-hidden",
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden relative">
      {/* Top Device Control & URL Bar Header */}
      <div className="h-12 border-b border-slate-200 bg-white px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-800">Live Preview</span>
          <div className="hidden sm:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
            <ShieldCheck className="w-3 h-3" />
            <span>Sandboxed</span>
          </div>

          {/* Multi-page selector if template has multiple HTML pages */}
          {htmlFiles.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 ml-1">
              {htmlFiles.map((hf) => (
                <button
                  key={hf.path}
                  onClick={() => setUserSelectedPath(hf.path)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    activeHtmlPath === hf.path
                      ? "bg-white text-purple-700 shadow-2xs border border-slate-200/80"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {hf.path}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mock Browser URL Bar */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 max-w-xs w-full">
          <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate font-mono text-[11px] text-slate-700">
            {typeof window !== "undefined" ? `${window.location.origin}/preview` : "https://codexys-ai-website-builder.vercel.app/preview"}
          </span>
        </div>

        {/* Viewport Control Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => setDeviceMode("desktop")}
              title="Desktop View"
              className={`p-1.5 rounded-md text-xs font-medium transition-all ${
                deviceMode === "desktop"
                  ? "bg-white text-purple-700 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeviceMode("tablet")}
              title="Tablet View (768px)"
              className={`p-1.5 rounded-md text-xs font-medium transition-all ${
                deviceMode === "tablet"
                  ? "bg-white text-purple-700 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeviceMode("mobile")}
              title="Mobile View (375px)"
              className={`p-1.5 rounded-md text-xs font-medium transition-all ${
                deviceMode === "mobile"
                  ? "bg-white text-purple-700 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          <button
            onClick={() => setRefreshKey((prev) => prev + 1)}
            disabled={!assembledSrcDoc}
            title="Refresh Preview"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all disabled:opacity-40"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleOpenNewTab}
            disabled={!assembledSrcDoc}
            title="Open preview in new browser tab"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all disabled:opacity-40"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport Area */}
      <div className="flex-1 bg-slate-100 flex items-center justify-center p-2 sm:p-6 overflow-hidden relative">
        {assembledSrcDoc ? (
          <div
            className={`transition-all duration-300 ease-in-out ${deviceWidths[deviceMode]} bg-white flex flex-col relative`}
          >
            <iframe
              key={refreshKey}
              ref={iframeRef}
              srcDoc={assembledSrcDoc}
              title="Live Website Preview"
              sandbox="allow-scripts allow-same-origin"
              className="w-full h-full border-none bg-white"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <Eye className="w-8 h-8 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">No Generated Preview</p>
              <p className="text-xs text-slate-500 mt-1">
                Enter your prompt to generate a custom website preview.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
