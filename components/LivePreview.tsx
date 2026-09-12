"use client";

import React, { useState, useMemo, useRef } from "react";
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

interface LivePreviewProps {
  files: GeneratedFile[];
  isGenerating: boolean;
}

export function LivePreview({ files, isGenerating }: LivePreviewProps) {
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [refreshKey, setRefreshKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Extract files
  const htmlFile = files.find((f) => f.path.endsWith("index.html"))?.content || "";
  const cssFile = files.find((f) => f.path.endsWith("styles.css"))?.content || "";
  const jsFile = files.find((f) => f.path.endsWith("script.js"))?.content || "";

  // Assemble full standalone HTML for iframe srcDoc
  const assembledSrcDoc = useMemo(() => {
    if (!htmlFile) return "";

    let doc = htmlFile;

    // Inject CSS into head if styles.css tag is linked
    if (cssFile) {
      const styleTag = `<style>\n/* AI GENERATED STYLES */\n${cssFile}\n</style>`;
      if (doc.includes("</head>")) {
        doc = doc.replace("</head>", `${styleTag}\n</head>`);
      } else {
        doc = `${styleTag}\n${doc}`;
      }
    }

    // Inject JS into body before </body>
    if (jsFile) {
      const scriptTag = `<script>\n// AI GENERATED INTERACTIVITY\ntry {\n${jsFile}\n} catch (e) { console.error('JS Error:', e); }\n</script>`;
      if (doc.includes("</body>")) {
        doc = doc.replace("</body>", `${scriptTag}\n</body>`);
      } else {
        doc = `${doc}\n${scriptTag}`;
      }
    }

    return doc;
  }, [htmlFile, cssFile, jsFile]);

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
              sandbox="allow-scripts"
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
