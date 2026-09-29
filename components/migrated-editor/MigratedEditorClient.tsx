"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Monitor,
  Tablet,
  Smartphone,
  Undo,
  Redo,
  Save,
  Send,
  Eye,
  Edit3,
  Layers,
  Image as ImageIcon,
  Type,
  Link as LinkIcon,
  Sliders,
  Upload,
  Check,
  Loader2,
  Sparkles,
  ExternalLink,
  ChevronRight,
  X,
  Palette,
  Layout,
  Globe,
  FileText,
} from "lucide-react";
import { assemblePreviewDoc } from "@/lib/preview-helper";

interface MigratedEditorClientProps {
  website: any;
  initialIndexPage: any;
  initialPages?: any[];
}

export interface SelectedElementData {
  id: string;
  tagName: string;
  type: "heading" | "text" | "image" | "button" | "section" | "container";
  textContent: string;
  innerHTML: string;
  src?: string;
  alt?: string;
  href?: string;
  target?: string;
  style: {
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    fontWeight?: string;
    textAlign?: string;
    fontFamily?: string;
    lineHeight?: string;
    letterSpacing?: string;
    padding?: string;
    margin?: string;
    borderRadius?: string;
    border?: string;
    width?: string;
    height?: string;
    objectFit?: string;
  };
}

export function MigratedEditorClient({ website, initialIndexPage, initialPages = [] }: MigratedEditorClientProps) {
  const router = useRouter();

  // Multi-page state
  const [pages, setPages] = useState<any[]>(
    initialPages.length > 0 ? initialPages : initialIndexPage ? [initialIndexPage] : []
  );
  const [activePageId, setActivePageId] = useState<string>(pages[0]?.id || "");

  // Compute active page
  const activePage = useMemo(() => {
    return pages.find((p) => p.id === activePageId) || pages[0] || initialIndexPage || null;
  }, [pages, activePageId, initialIndexPage]);

  // Content state
  const [htmlContent, setHtmlContent] = useState<string>(activePage?.html_content || "");
  const [cssContent, setCssContent] = useState<string>(activePage?.css_content || "");
  const [jsContent, setJsContent] = useState<string>(activePage?.js_content || "");

  // Page loading state for on-demand secondary page fetch
  const [isLoadingPage, setIsLoadingPage] = useState<boolean>(false);

  // Update canvas content when switching active page
  useEffect(() => {
    if (!activePage) return;

    if (activePage.html_content !== undefined) {
      setHtmlContent(activePage.html_content || "");
      setCssContent(activePage.css_content || "");
      setJsContent(activePage.js_content || "");
      setSelectedElement(null);
      setHistory([]);
      setHistoryIndex(-1);
    } else if (activePage.id && website?.id) {
      setIsLoadingPage(true);
      fetch(`/api/websites/${website.id}/editor/page?pageId=${activePage.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.page) {
            setPages((prevPages) =>
              prevPages.map((p) => (p.id === data.page.id ? { ...p, ...data.page } : p))
            );
            setHtmlContent(data.page.html_content || "");
            setCssContent(data.page.css_content || "");
            setJsContent(data.page.js_content || "");
            setSelectedElement(null);
            setHistory([]);
            setHistoryIndex(-1);
          }
        })
        .catch((err) => {
          console.error("Failed to load secondary page content:", err);
        })
        .finally(() => {
          setIsLoadingPage(false);
        });
    }
  }, [activePageId, activePage, website?.id]);

  // Editor mode & viewport controls
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [activeLeftTab, setActiveLeftTab] = useState<"layers" | "media">("layers");

  // Selection & Inspector state
  const [selectedElement, setSelectedElement] = useState<SelectedElementData | null>(null);
  const [domTree, setDomTree] = useState<any | null>(null);

  // Undo / Redo history stack
  const [history, setHistory] = useState<SelectedElementData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // UI status states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<any[]>([]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assemble current iframe srcDoc
  const assembledSrcDoc = useMemo(() => {
    return assemblePreviewDoc(htmlContent, cssContent, jsContent, isEditMode);
  }, [htmlContent, cssContent, jsContent, isEditMode]);

  // PostMessage event listener from iframe bridge
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data, tree, html } = event.data || {};

      if (type === "CODEAXYS_ELEMENT_SELECTED") {
        setSelectedElement(data);
      } else if (type === "CODEAXYS_DOM_TREE") {
        setDomTree(tree);
      } else if (type === "CODEAXYS_CANVAS_READY") {
        setIsLoadingPage(false);
      } else if (type === "CODEAXYS_CLEAN_HTML_RESPONSE" && html) {
        setHtmlContent(html);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Send updates to iframe sandbox
  const postToIframe = (msgType: string, payload: any) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: msgType, payload }, "*");
    }
  };

  // 1. Text Update Handler
  const handleTextChange = (newText: string) => {
    if (!selectedElement) return;

    const updated = { ...selectedElement, textContent: newText };
    setSelectedElement(updated);
    pushHistory(updated);

    postToIframe("UPDATE_TEXT", { id: selectedElement.id, textContent: newText });
  };

  // 2. Image Update Handler
  const handleImageChange = (newSrc: string, newAlt?: string, newWidth?: string, newHeight?: string) => {
    if (!selectedElement) return;

    const updated = {
      ...selectedElement,
      src: newSrc,
      alt: newAlt !== undefined ? newAlt : selectedElement.alt,
    };
    setSelectedElement(updated);
    pushHistory(updated);

    postToIframe("UPDATE_IMAGE", {
      id: selectedElement.id,
      src: newSrc,
      alt: newAlt !== undefined ? newAlt : selectedElement.alt,
      width: newWidth,
      height: newHeight,
    });
  };

  // 3. Link Update Handler
  const handleLinkChange = (newText?: string, newHref?: string, newTarget?: string) => {
    if (!selectedElement) return;

    const updated = {
      ...selectedElement,
      textContent: newText !== undefined ? newText : selectedElement.textContent,
      href: newHref !== undefined ? newHref : selectedElement.href,
      target: newTarget !== undefined ? newTarget : selectedElement.target,
    };
    setSelectedElement(updated);
    pushHistory(updated);

    postToIframe("UPDATE_LINK", {
      id: selectedElement.id,
      textContent: newText,
      href: newHref,
      target: newTarget,
    });
  };

  // 4. Style Update Handler
  const handleStyleChange = (styleKey: string, styleValue: string) => {
    if (!selectedElement) return;

    const updatedStyle = { ...selectedElement.style, [styleKey]: styleValue };
    const updated = { ...selectedElement, style: updatedStyle };
    setSelectedElement(updated);
    pushHistory(updated);

    postToIframe("UPDATE_STYLE", {
      id: selectedElement.id,
      style: { [styleKey]: styleValue },
    });
  };

  // History Push Helper
  const pushHistory = (state: SelectedElementData) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(state);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  // Undo Handler
  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    setHistoryIndex(historyIndex - 1);
    setSelectedElement(prev);

    if (prev.type === "image") {
      postToIframe("UPDATE_IMAGE", { id: prev.id, src: prev.src, alt: prev.alt });
    } else if (prev.type === "button") {
      postToIframe("UPDATE_LINK", { id: prev.id, textContent: prev.textContent, href: prev.href });
    } else {
      postToIframe("UPDATE_TEXT", { id: prev.id, textContent: prev.textContent });
    }
    if (prev.style) {
      postToIframe("UPDATE_STYLE", { id: prev.id, style: prev.style });
    }
  };

  // Redo Handler
  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setHistoryIndex(historyIndex + 1);
    setSelectedElement(next);

    if (next.type === "image") {
      postToIframe("UPDATE_IMAGE", { id: next.id, src: next.src, alt: next.alt });
    } else if (next.type === "button") {
      postToIframe("UPDATE_LINK", { id: next.id, textContent: next.textContent, href: next.href });
    } else {
      postToIframe("UPDATE_TEXT", { id: next.id, textContent: next.textContent });
    }
    if (next.style) {
      postToIframe("UPDATE_STYLE", { id: next.id, style: next.style });
    }
  };

  // Handle Image Upload for Replacement
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setIsUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("websiteId", website.id);

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.asset?.public_url) {
        setMediaAssets((prev) => [data.asset, ...prev]);
        if (selectedElement && selectedElement.type === "image") {
          handleImageChange(data.asset.public_url);
        }
      } else {
        alert(data.error || "Failed to upload image.");
      }
    } catch (err) {
      console.error("Upload Error:", err);
      alert("Error uploading image file.");
    } finally {
      setIsUploadingMedia(false);
      e.target.value = "";
    }
  };

  // Save Snapshot to Database
  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    // Request fresh clean HTML from iframe bridge first
    postToIframe("GET_CLEAN_HTML", {});

    // Small delay to allow message roundtrip
    await new Promise((r) => setTimeout(r, 200));

    try {
      const response = await fetch(`/api/websites/${website.id}/save-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: activePage?.id,
          path: activePage?.path,
          htmlContent,
          cssContent,
          jsContent,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPages((prevPages) =>
          prevPages.map((p) =>
            p.id === activePage?.id || p.path === activePage?.path
              ? { ...p, html_content: htmlContent, css_content: cssContent, js_content: jsContent }
              : p
          )
        );
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        router.refresh();
      } else {
        setSaveError(data.error || "Failed to save website changes.");
      }
    } catch (err: any) {
      console.error("Save snapshot error:", err);
      setSaveError(err?.message || "An unexpected error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Publish Website
  const handlePublish = async () => {
    if (isPublishing) return;
    setIsPublishing(true);

    try {
      // First save current edited snapshot
      await handleSave();

      const endpoint = website.is_published
        ? `/api/websites/${website.id}/unpublish`
        : `/api/websites/${website.id}/publish`;

      const response = await fetch(endpoint, { method: "POST" });
      const data = await response.json();

      if (response.ok && data.success) {
        alert(website.is_published ? "Website unpublished." : "Website published live!");
        router.refresh();
      }
    } catch (e) {
      console.error("Publish error:", e);
    } finally {
      setIsPublishing(false);
    }
  };

  const deviceWidths = {
    desktop: "w-full h-full",
    tablet: "w-[768px] h-[92%] my-auto shadow-2xl rounded-2xl border border-slate-300 overflow-hidden",
    mobile: "w-[375px] h-[88%] my-auto shadow-2xl rounded-3xl border border-slate-300 overflow-hidden",
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 text-slate-900 font-sans overflow-hidden select-none">
      {/* 1. TOP HEADER TOOLBAR */}
      <header className="h-14 border-b border-slate-200/90 bg-white px-4 flex items-center justify-between shrink-0 z-30 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/websites/${website.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
            <span>Dashboard</span>
          </Link>

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          <div className="flex items-center gap-2 max-w-xs sm:max-w-md overflow-hidden">
            <span className="text-xs font-black text-slate-900 truncate" title={website.title}>
              {website.title}
            </span>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
              Migrated Visual Editor
            </span>
          </div>

          {/* Page Selector Dropdown */}
          {pages.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
              <FileText className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider hidden lg:inline">Page:</span>
              <select
                value={activePageId || pages[0]?.id}
                onChange={(e) => setActivePageId(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-900 outline-none focus:border-purple-500 cursor-pointer max-w-[170px] truncate"
              >
                {pages.map((p, idx) => (
                  <option key={p.id || idx} value={p.id}>
                    {p.path === "index.html" || p.path === "/" ? "Home (index.html)" : p.path}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Center: Viewport Controls & Interactive Preview Switch */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setDeviceMode("desktop")}
              title="Desktop View"
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                deviceMode === "desktop"
                  ? "bg-white text-purple-700 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeviceMode("tablet")}
              title="Tablet View (768px)"
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                deviceMode === "tablet"
                  ? "bg-white text-purple-700 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeviceMode("mobile")}
              title="Mobile View (375px)"
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                deviceMode === "mobile"
                  ? "bg-white text-purple-700 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 border ${
              isEditMode
                ? "bg-purple-50 text-purple-700 border-purple-200 shadow-2xs"
                : "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs"
            }`}
          >
            {isEditMode ? (
              <>
                <Edit3 className="w-3.5 h-3.5 text-purple-600" />
                <span>Visual Edit Mode</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span>Interactive Preview</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Actions (Undo, Redo, Save, Publish) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-1">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Undo Change"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 disabled:opacity-30"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Redo Change"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 disabled:opacity-30"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
            ) : saveSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Save className="w-3.5 h-3.5 text-slate-600" />
            )}
            <span>{isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save Changes"}</span>
          </button>

          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold transition-all shadow-md shadow-purple-600/20 flex items-center gap-1.5"
          >
            {isPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Publish</span>
          </button>
        </div>
      </header>

      {/* Save Error Alert Banner */}
      {saveError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-1.5 text-xs text-red-700 font-semibold flex items-center justify-between">
          <span>Failed to save changes: {saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-red-500 hover:text-red-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. MAIN WORKSPACE CONTENT */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT PANEL: Layers & Media */}
        <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-full overflow-hidden shrink-0 z-20">
          <div className="h-10 border-b border-slate-200 flex items-center bg-slate-50 px-2 gap-1">
            <button
              onClick={() => setActiveLeftTab("layers")}
              className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeLeftTab === "layers"
                  ? "bg-white text-purple-700 shadow-2xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>DOM Layers</span>
            </button>
            <button
              onClick={() => setActiveLeftTab("media")}
              className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeLeftTab === "media"
                  ? "bg-white text-purple-700 shadow-2xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Media</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            {activeLeftTab === "layers" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Captured Structure
                  </span>
                  <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-mono font-bold">
                    Exact DOM
                  </span>
                </div>

                <div className="text-xs space-y-1 font-mono text-slate-700">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
                    <Layout className="w-3.5 h-3.5 text-purple-600" />
                    <span className="font-bold">Captured Snapshot Page</span>
                  </div>
                  <div className="pl-3 space-y-1">
                    <div className="p-1.5 rounded hover:bg-purple-50 hover:text-purple-700 cursor-pointer flex items-center gap-1.5 text-[11px]">
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      <span>Header & Navigation</span>
                    </div>
                    <div className="p-1.5 rounded hover:bg-purple-50 hover:text-purple-700 cursor-pointer flex items-center gap-1.5 text-[11px]">
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      <span>Hero Section & Slider</span>
                    </div>
                    <div className="p-1.5 rounded hover:bg-purple-50 hover:text-purple-700 cursor-pointer flex items-center gap-1.5 text-[11px]">
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      <span>Main Content Sections</span>
                    </div>
                    <div className="p-1.5 rounded hover:bg-purple-50 hover:text-purple-700 cursor-pointer flex items-center gap-1.5 text-[11px]">
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      <span>Footer & Actions</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Asset Manager
                  </span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingMedia}
                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition-all flex items-center gap-1"
                  >
                    {isUploadingMedia ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    <span>Upload</span>
                  </button>
                </div>

                {mediaAssets.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500 space-y-2">
                    <ImageIcon className="w-6 h-6 text-slate-300 mx-auto" />
                    <p>Upload replacement images for hero sliders, logos, or galleries.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {mediaAssets.map((asset, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          if (selectedElement && selectedElement.type === "image") {
                            handleImageChange(asset.public_url);
                          }
                        }}
                        className="group relative rounded-lg border border-slate-200 overflow-hidden bg-slate-50 aspect-square cursor-pointer hover:border-purple-400 transition-all"
                      >
                        <img src={asset.public_url} alt="Media" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-purple-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold">
                          Apply Image
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* CENTER VISUAL CANVAS */}
        <main className="flex-1 bg-slate-200 flex items-center justify-center p-3 sm:p-6 overflow-hidden relative">
          <div className={`transition-all duration-300 ${deviceWidths[deviceMode]} bg-white flex flex-col relative`}>
            {assembledSrcDoc ? (
              <>
                <iframe
                  ref={iframeRef}
                  srcDoc={assembledSrcDoc}
                  title="Migrated Visual Canvas"
                  sandbox="allow-scripts allow-same-origin"
                  className="w-full h-full border-none bg-white pointer-events-auto"
                />
                {isLoadingPage && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center gap-2 text-xs font-extrabold text-purple-700 z-10">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                    <span>Loading Page Content...</span>
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            )}
          </div>
        </main>

        {/* RIGHT PANEL: Properties Inspector */}
        <aside className="w-80 border-l border-slate-200 bg-white flex flex-col h-full overflow-hidden shrink-0 z-20">
          <div className="h-10 border-b border-slate-200 flex items-center justify-between bg-slate-50 px-4">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-purple-600" />
              <span>Inspector</span>
            </span>
            {selectedElement && (
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                {selectedElement.type} ({selectedElement.tagName})
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
            {!selectedElement ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center">
                  <Edit3 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Click Any Element to Edit</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Click headings, buttons, images, links, or sections on the visual canvas to customize properties.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* 1. TEXT CONTENT EDITING */}
                {(selectedElement.type === "heading" || selectedElement.type === "text" || selectedElement.type === "button") && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-purple-600" />
                      <span>Text Content</span>
                    </label>
                    <textarea
                      value={selectedElement.textContent}
                      onChange={(e) => handleTextChange(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-purple-500 focus:bg-white transition-all resize-none"
                    />
                  </div>
                )}

                {/* 2. IMAGE EDITING */}
                {selectedElement.type === "image" && (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                      <span>Image Settings</span>
                    </label>

                    {selectedElement.src && (
                      <div className="w-full h-28 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
                        <img src={selectedElement.src} alt="Preview" className="max-h-full max-w-full object-contain" />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-600">Image Source URL</span>
                      <input
                        type="text"
                        value={selectedElement.src || ""}
                        onChange={(e) => handleImageChange(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-600">Alt Text</span>
                      <input
                        type="text"
                        value={selectedElement.alt || ""}
                        onChange={(e) => handleImageChange(selectedElement.src || "", e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 focus:bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* 3. BUTTON / LINK EDITING */}
                {(selectedElement.type === "button" || selectedElement.href !== undefined) && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-purple-600" />
                      <span>Button / Link Action</span>
                    </label>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-600">Destination URL</span>
                      <input
                        type="text"
                        value={selectedElement.href || ""}
                        onChange={(e) => handleLinkChange(undefined, e.target.value, undefined)}
                        placeholder="e.g. /contact or https://..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-600">Target</span>
                      <select
                        value={selectedElement.target || "_self"}
                        onChange={(e) => handleLinkChange(undefined, undefined, e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-purple-500"
                      >
                        <option value="_self">Same Tab (_self)</option>
                        <option value="_blank">New Tab (_blank)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 4. VISUAL STYLE PROPERTIES */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-purple-600" />
                    <span>Styling & Colors</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-600 block mb-1">Text Color</span>
                      <input
                        type="color"
                        value={selectedElement.style?.color || "#000000"}
                        onChange={(e) => handleStyleChange("color", e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-600 block mb-1">Background</span>
                      <input
                        type="color"
                        value={selectedElement.style?.backgroundColor || "#ffffff"}
                        onChange={(e) => handleStyleChange("backgroundColor", e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 p-0.5 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Font Size & Weight */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-600 block mb-1">Font Size</span>
                      <input
                        type="text"
                        value={selectedElement.style?.fontSize || ""}
                        onChange={(e) => handleStyleChange("fontSize", e.target.value)}
                        placeholder="e.g. 24px"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-600 block mb-1">Font Weight</span>
                      <select
                        value={selectedElement.style?.fontWeight || "normal"}
                        onChange={(e) => handleStyleChange("fontWeight", e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-purple-500"
                      >
                        <option value="normal">Normal (400)</option>
                        <option value="bold">Bold (700)</option>
                        <option value="800">Extra Bold (800)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
