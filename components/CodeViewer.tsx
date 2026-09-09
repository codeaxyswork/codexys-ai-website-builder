"use client";

import React, { useState } from "react";
import {
  FileCode,
  FileText,
  Copy,
  Check,
  Download,
  Code2,
  ChevronRight,
  FileJson,
} from "lucide-react";
import { GeneratedFile, WebsitePlan } from "@/lib/types";

interface CodeViewerProps {
  files: GeneratedFile[];
  plan: WebsitePlan | null;
}

export function CodeViewer({ files, plan }: CodeViewerProps) {
  const [selectedFile, setSelectedFile] = useState<string>("index.html");
  const [copied, setCopied] = useState<boolean>(false);

  // Available files list including simulated plan.json
  const fileOptions = [
    ...files.map((f) => f.path),
    ...(plan ? ["plan.json"] : []),
  ];

  // Get active file content
  let activeContent = "";
  if (selectedFile === "plan.json" && plan) {
    activeContent = JSON.stringify(plan, null, 2);
  } else {
    activeContent = files.find((f) => f.path === selectedFile)?.content || "// Select a file to view content";
  }

  const handleCopy = () => {
    if (!activeContent) return;
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    if (!activeContent) return;
    const mimeType = selectedFile.endsWith(".html")
      ? "text/html"
      : selectedFile.endsWith(".css")
      ? "text/css"
      : selectedFile.endsWith(".json")
      ? "application/json"
      : "application/javascript";

    const blob = new Blob([activeContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedFile;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith(".html")) return <FileCode className="w-3.5 h-3.5 text-orange-400" />;
    if (fileName.endsWith(".css")) return <FileText className="w-3.5 h-3.5 text-cyan-400" />;
    if (fileName.endsWith(".js")) return <Code2 className="w-3.5 h-3.5 text-yellow-400" />;
    if (fileName.endsWith(".json")) return <FileJson className="w-3.5 h-3.5 text-indigo-400" />;
    return <FileText className="w-3.5 h-3.5 text-slate-400" />;
  };

  const lines = activeContent.split("\n");

  return (
    <div className="w-full lg:w-96 border-l border-slate-800 bg-slate-950 flex flex-col h-full overflow-hidden shrink-0">
      {/* File Selector Header Tabs */}
      <div className="h-12 border-b border-slate-800 bg-slate-950 px-3 flex items-center justify-between shrink-0 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-1">
          {fileOptions.map((fileName) => (
            <button
              key={fileName}
              onClick={() => setSelectedFile(fileName)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                selectedFile === fileName
                  ? "bg-slate-800 text-slate-100 shadow-sm border border-slate-700"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              {getFileIcon(fileName)}
              <span>{fileName}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            onClick={handleCopy}
            disabled={!activeContent}
            title="Copy file contents"
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all disabled:opacity-40"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleDownloadFile}
            disabled={!activeContent}
            title="Download file"
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Code Content Viewer */}
      <div className="flex-1 overflow-auto bg-slate-950 font-mono text-xs p-3 text-slate-300 leading-relaxed custom-scrollbar">
        {files.length === 0 && !plan ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 p-6 text-center">
            <Code2 className="w-8 h-8 text-slate-700" />
            <p className="text-xs">Generated website code will appear here after prompt execution.</p>
          </div>
        ) : (
          <div className="table w-full">
            {lines.map((line, idx) => (
              <div key={idx} className="table-row hover:bg-slate-900/60 rounded">
                <span className="table-cell select-none pr-4 text-right text-slate-600 text-[10px] w-8">
                  {idx + 1}
                </span>
                <span className="table-cell whitespace-pre-wrap break-all text-[11px]">
                  {line || " "}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
