"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { isValidTemplateId } from "@/lib/auth-redirect";
import {
  Sparkles,
  Eye,
  X,
  Pause,
  Play,
  Search,
  ChevronDown,
  Check,
  RotateCcw,
  Loader2,
  Filter,
  AlertCircle,
} from "lucide-react";

import { TEMPLATES_DATA, type TemplateItem } from "@/lib/template-registry";
export { TEMPLATES_DATA, type TemplateItem };

export function AIBuiltTemplatesShowcase() {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterSearchQuery, setFilterSearchQuery] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const prefetchedUrls = useRef<Set<string>>(new Set());

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(e.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

  // Non-blocking prefetch on hover to eliminate preview latency
  const handlePrefetch = useCallback((template: TemplateItem) => {
    if (typeof window === "undefined") return;
    const url = `/api/templates-preview/${encodeURIComponent(template.folderName)}/index.html`;
    if (prefetchedUrls.current.has(url)) return;
    prefetchedUrls.current.add(url);
    try {
      fetch(url, { priority: "low" as RequestPriority }).catch(() => {});
    } catch {
      // Ignore background prefetch errors
    }
  }, []);

  const handleClosePreview = useCallback(() => {
    setSelectedTemplate(null);
    setIsPreviewLoading(true);
    setPreviewError(false);
  }, []);

  const handleOpenPreview = useCallback((template: TemplateItem) => {
    if (typeof window !== "undefined") {
      scrollPositionRef.current = window.scrollY;
    }
    setIsPreviewLoading(true);
    setPreviewError(false);
    setSelectedTemplate(template);
  }, []);

  const handleRetryPreview = useCallback(() => {
    setIsPreviewLoading(true);
    setPreviewError(false);
    setPreviewReloadKey((k) => k + 1);
  }, []);

  const handleEditWithAi = useCallback(
    async (template: TemplateItem) => {
      if (!template || !isValidTemplateId(template.id)) return;

      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        const activeUser = data?.user || null;

        if (activeUser) {
          handleClosePreview();
          router.push(`/?template=${encodeURIComponent(template.id)}`);
        } else {
          if (typeof window !== "undefined") {
            sessionStorage.setItem("pending_template", template.id);
          }
          handleClosePreview();
          router.push(`/login?reason=template_edit&template=${encodeURIComponent(template.id)}`);
        }
      } catch {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("pending_template", template.id);
        }
        handleClosePreview();
        router.push(`/login?reason=template_edit&template=${encodeURIComponent(template.id)}`);
      }
    },
    [handleClosePreview, router]
  );

  // Close full-screen preview with ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedTemplate) {
          handleClosePreview();
        } else if (isFilterOpen) {
          setIsFilterOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTemplate, isFilterOpen, handleClosePreview]);

  // Lock body scroll when full-screen preview is open, and restore exact previous homepage position
  useEffect(() => {
    if (selectedTemplate && typeof window !== "undefined") {
      scrollPositionRef.current = window.scrollY;
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = originalOverflow;
        window.scrollTo({
          top: scrollPositionRef.current,
          behavior: "instant" as ScrollBehavior,
        });
      };
    }
  }, [selectedTemplate]);

  const previewUrl = selectedTemplate
    ? `/api/templates-preview/${encodeURIComponent(selectedTemplate.folderName)}/index.html`
    : "";

  // Filter dropdown options
  const filteredOptions = useMemo(() => {
    if (!filterSearchQuery.trim()) return TEMPLATES_DATA;
    const q = filterSearchQuery.toLowerCase();
    return TEMPLATES_DATA.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }, [filterSearchQuery]);

  // Active filtered template (if filter selected)
  const activeFilteredTemplate = useMemo(() => {
    if (!selectedFilterId) return null;
    return TEMPLATES_DATA.find((t) => t.id === selectedFilterId) || null;
  }, [selectedFilterId]);

  // Duplicated set for seamless continuous horizontal loop when no filter is active
  const displayItems = useMemo(() => [...TEMPLATES_DATA, ...TEMPLATES_DATA], []);

  // Render a template card
  const renderCard = (template: TemplateItem, key: string, priority: boolean = false) => (
    <div
      key={key}
      onMouseEnter={() => handlePrefetch(template)}
      className="group relative flex flex-col justify-between w-[290px] sm:w-[calc(50vw-36px)] md:w-[340px] lg:w-[285px] xl:w-[305px] h-[390px] bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-md hover:shadow-xl hover:border-purple-300 transition-all duration-300 shrink-0"
    >
      {/* Thumbnail Container */}
      <div
        onClick={() => handleOpenPreview(template)}
        className="relative w-full h-[180px] rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 shadow-inner cursor-pointer"
      >
        <Image
          src={template.thumbnail}
          alt={`${template.name} Preview Thumbnail`}
          fill
          sizes="(max-width: 640px) 290px, (max-width: 1024px) 340px, 305px"
          className="object-cover object-top transition-transform duration-500 ease-out group-hover:scale-105"
          priority={priority}
        />

        {/* Category Pill Tag */}
        <div className="absolute top-2.5 left-2.5 z-10">
          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white/90 backdrop-blur-md text-slate-800 border border-white/40 shadow-xs">
            {template.category}
          </span>
        </div>
      </div>

      {/* Template Information */}
      <div className="pt-4 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <h3
            onClick={() => handleOpenPreview(template)}
            className="text-base font-extrabold text-slate-900 group-hover:text-purple-600 transition-colors line-clamp-1 cursor-pointer"
          >
            {template.name}
          </h3>
          <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-2">
            {template.description}
          </p>
        </div>

        {/* Card Action Row: Simple Preview Button */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-400">
            Live Demo Ready
          </span>
          <button
            type="button"
            onClick={() => handleOpenPreview(template)}
            className="px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white border border-purple-200/80 hover:border-purple-600 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs group-hover:shadow-sm"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <section
      id="ai-templates"
      className="py-24 bg-gradient-to-b from-white via-slate-50/60 to-white border-b border-slate-200/80 relative overflow-hidden"
    >
      {/* Background ambient accents */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          {/* Section Header */}
          <div className="space-y-3 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 uppercase tracking-widest bg-purple-100/80 px-4 py-1.5 rounded-full border border-purple-200/80 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Curated Showcase
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              AI Built{" "}
              <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-800 bg-clip-text text-transparent">
                Templates
              </span>
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed">
              Explore professional website samples created with our AI website builder.
            </p>
          </div>

          {/* Controls Bar: Badge, Searchable Filter, and Pause Button with matching h-[38px] */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Status Pill Badge - Visually matched height to Pause button */}
            <div className="h-[38px] hidden sm:flex items-center gap-2 px-3.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>20 Real Templates</span>
            </div>

            {/* Template Filter Control */}
            <div className="relative" ref={filterDropdownRef}>
              <button
                type="button"
                onClick={() => setIsFilterOpen((prev) => !prev)}
                aria-expanded={isFilterOpen}
                aria-label="Filter templates by name"
                className={`h-[38px] px-3.5 rounded-xl bg-white hover:bg-slate-50 border transition-all shadow-2xs cursor-pointer flex items-center gap-2 text-xs font-semibold ${
                  activeFilteredTemplate
                    ? "border-purple-300 text-purple-700 bg-purple-50/50"
                    : "border-slate-200 text-slate-700 hover:text-purple-600"
                }`}
              >
                <Filter className="w-3.5 h-3.5 shrink-0 text-purple-600" />
                <span className="max-w-[130px] sm:max-w-[170px] truncate">
                  {activeFilteredTemplate ? activeFilteredTemplate.name : "Filter by Name..."}
                </span>
                {activeFilteredTemplate ? (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFilterId(null);
                    }}
                    className="p-0.5 rounded-full hover:bg-purple-200 text-purple-600 cursor-pointer"
                    title="Clear filter and view all templates"
                  >
                    <X className="w-3 h-3" />
                  </span>
                ) : (
                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                )}
              </button>

              {/* Searchable Dropdown Popover */}
              {isFilterOpen && (
                <div className="absolute right-0 sm:left-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Search input */}
                  <div className="relative mb-2 px-1 pt-1">
                    <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={filterSearchQuery}
                      onChange={(e) => setFilterSearchQuery(e.target.value)}
                      placeholder="Search 20 templates..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:bg-white transition-all"
                      autoFocus
                    />
                  </div>

                  {/* Template options list */}
                  <div className="max-h-60 overflow-y-auto space-y-0.5 pr-1">
                    {/* View all / reset option */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFilterId(null);
                        setIsFilterOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        selectedFilterId === null
                          ? "bg-purple-50 text-purple-700 font-bold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        <span>All Templates (Show All 20)</span>
                      </div>
                      {selectedFilterId === null && <Check className="w-3.5 h-3.5 text-purple-600" />}
                    </button>

                    {filteredOptions.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          setSelectedFilterId(tpl.id);
                          setIsFilterOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                          selectedFilterId === tpl.id
                            ? "bg-purple-50 text-purple-700 font-bold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex flex-col text-left">
                          <span className="font-semibold text-slate-900">{tpl.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{tpl.category}</span>
                        </div>
                        {selectedFilterId === tpl.id && <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                      </button>
                    ))}

                    {filteredOptions.length === 0 && (
                      <div className="py-4 text-center text-xs text-slate-400">
                        No templates match &ldquo;{filterSearchQuery}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Pause / Resume Button - Reference height h-[38px] */}
            <button
              type="button"
              onClick={() => setIsManuallyPaused((prev) => !prev)}
              aria-label={isManuallyPaused ? "Resume scrolling" : "Pause scrolling"}
              className="h-[38px] px-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-purple-600 transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              {isManuallyPaused ? (
                <>
                  <Play className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="hidden sm:inline">Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Showcase Presentation: Filtered Card View or Seamless Marquee Carousel */}
      {activeFilteredTemplate ? (
        /* Filtered View: Displays the selected template card with immediate Preview capability */
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col items-center">
          <div className="mb-6 flex items-center gap-3 px-4 py-2 rounded-2xl bg-purple-50/80 border border-purple-200/80 shadow-2xs">
            <span className="text-xs font-semibold text-purple-950">
              Showing filter: <strong>{activeFilteredTemplate.name}</strong>
            </span>
            <button
              type="button"
              onClick={() => setSelectedFilterId(null)}
              className="text-xs font-bold text-purple-700 hover:text-purple-950 underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset & view all 20</span>
            </button>
          </div>

          <div className="flex justify-center w-full">
            {renderCard(activeFilteredTemplate, `filtered-${activeFilteredTemplate.id}`, true)}
          </div>
        </div>
      ) : (
        /* Marquee Horizontal Carousel Outer Container */
        <div
          className="relative w-full overflow-hidden py-4"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Left & Right Subtle Fade Overlays for Seamless Edge Visuals */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 sm:w-20 md:w-32 bg-gradient-to-r from-white via-white/80 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 sm:w-20 md:w-32 bg-gradient-to-l from-white via-white/80 to-transparent z-10" />

          {/* Scrolling Inner Track */}
          <div
            className="flex gap-6 w-max select-none"
            style={{
              animation: "codeaxys-marquee 90s linear infinite",
              animationPlayState: isHovered || isManuallyPaused ? "paused" : "running",
              willChange: "transform",
            }}
          >
            {displayItems.map((template, idx) =>
              renderCard(template, `${template.id}-${idx}`, idx < 4)
            )}
          </div>
        </div>
      )}

      {/* Marquee Keyframe Styles */}
      <style jsx global>{`
        @keyframes codeaxys-marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>

      {/* FULL-SCREEN TEMPLATE PREVIEW VIEWER */}
      {selectedTemplate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedTemplate.name} Full-Screen Preview`}
          className="fixed inset-0 z-[9999] w-screen h-screen bg-slate-950 overflow-hidden animate-in fade-in duration-200"
        >
          {/* Top Info Pill */}
          <div className="fixed top-[calc(env(safe-area-inset-top,0px)+56px)] left-4 sm:top-6 sm:left-6 z-[10000] pointer-events-none max-w-[calc(100vw-130px)]">
            <div className="flex items-center gap-2.5 px-3.5 sm:px-4 py-2 rounded-full bg-slate-900/90 text-white backdrop-blur-md shadow-2xl border border-white/20 text-xs font-semibold shadow-black/40">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0" />
              <span className="truncate max-w-[110px] min-[380px]:max-w-[160px] sm:max-w-none">{selectedTemplate.name}</span>
              <span className="text-slate-400 text-[11px] hidden sm:inline shrink-0">• {selectedTemplate.category}</span>
            </div>
          </div>

          {/* Top-Right Action Controls: Close button & Edit with AI CTA */}
          <div className="fixed top-[calc(env(safe-area-inset-top,0px)+56px)] right-4 sm:top-6 sm:right-6 z-[10000] flex flex-col items-end gap-2.5">
            <button
              type="button"
              onClick={handleClosePreview}
              aria-label="Close preview"
              className="group flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 hover:bg-slate-950 text-white backdrop-blur-md shadow-2xl border border-white/20 text-xs font-bold transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer shadow-black/40"
            >
              <span>Close</span>
              <X className="w-4 h-4 text-slate-300 group-hover:text-white transition-colors" />
            </button>

            {/* Premium Edit with AI CTA Button */}
            <button
              type="button"
              onClick={() => handleEditWithAi(selectedTemplate)}
              aria-label={`Edit ${selectedTemplate.name} with AI`}
              className="group flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:via-indigo-500 hover:to-purple-600 text-white backdrop-blur-md shadow-2xl shadow-purple-900/50 border border-purple-400/40 text-xs font-extrabold tracking-wide transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-200 group-hover:rotate-12 transition-transform duration-300" />
              <span>Edit with AI</span>
            </button>
          </div>

          {/* Lightweight Loading State Overlay */}
          {isPreviewLoading && !previewError && (
            <div className="absolute inset-0 z-[9998] flex flex-col items-center justify-center bg-slate-900 text-white">
              <div className="flex flex-col items-center gap-4 max-w-sm px-6 text-center">
                <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-400 shadow-xl">
                  <Loader2 className="w-7 h-7 animate-spin" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-base font-bold text-white tracking-tight">
                    Loading {selectedTemplate.name}...
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">
                    Initializing live template demo and assets
                  </p>
                </div>
                <div className="w-44 h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full animate-pulse w-3/4" />
                </div>
              </div>
            </div>
          )}

          {/* Error State with Retry */}
          {previewError && (
            <div className="absolute inset-0 z-[9998] flex flex-col items-center justify-center bg-slate-900 text-white px-6">
              <div className="flex flex-col items-center gap-4 max-w-md text-center p-8 rounded-3xl bg-slate-800/90 border border-slate-700 shadow-2xl">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">Preview Temporarily Unavailable</h4>
                  <p className="text-xs text-slate-400">
                    Could not load {selectedTemplate.name}. Please check your connection and retry.
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleRetryPreview}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClosePreview}
                    className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Full-screen isolated template iframe */}
          <iframe
            key={`${selectedTemplate.id}-${previewReloadKey}`}
            ref={iframeRef}
            src={previewUrl}
            title={`${selectedTemplate.name} Website Preview`}
            className={`w-full h-full border-0 block bg-white transition-opacity duration-300 ${
              isPreviewLoading ? "opacity-0" : "opacity-100"
            }`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            onLoad={() => setIsPreviewLoading(false)}
            onError={() => {
              setIsPreviewLoading(false);
              setPreviewError(true);
            }}
          />
        </div>
      )}
    </section>
  );
}
