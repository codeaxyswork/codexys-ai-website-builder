"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  Sparkles,
  Eye,
  X,
  Pause,
  Play,
} from "lucide-react";

export interface TemplateItem {
  id: string;
  folderName: string;
  name: string;
  category: string;
  description: string;
  thumbnail: string;
}

export const TEMPLATES_DATA: TemplateItem[] = [
  {
    id: "accounting-firm",
    folderName: "Accounting Firm",
    name: "Accounting Firm",
    category: "Finance & Advisory",
    description: "Apex Partners — Corporate accounting, tax planning, and advisory services.",
    thumbnail: "/template-thumbnails/accounting-firm.jpg",
  },
  {
    id: "architecture",
    folderName: "Architecture",
    name: "Architecture",
    category: "Design & Construction",
    description: "FORMA Studio — Modern architectural design, blueprints, and portfolio.",
    thumbnail: "/template-thumbnails/architecture.jpg",
  },
  {
    id: "beauty-salon",
    folderName: "Beauty Salon",
    name: "Beauty Salon",
    category: "Beauty & Wellness",
    description: "Lumière — Premium salon styling, aesthetics, treatments, and bookings.",
    thumbnail: "/template-thumbnails/beauty-salon.jpg",
  },
  {
    id: "creative-agency",
    folderName: "Creative Agency",
    name: "Creative Agency",
    category: "Digital Agency",
    description: "AETERNA — Branding, creative direction, mobile design, and digital innovation.",
    thumbnail: "/template-thumbnails/creative-agency.jpg",
  },
  {
    id: "digital-marketing-agency",
    folderName: "Digital Marketing agency",
    name: "Digital Marketing agency",
    category: "Marketing & Growth",
    description: "ApexGrowth — Performance marketing, SEO, paid ads, and brand analytics.",
    thumbnail: "/template-thumbnails/digital-marketing-agency.jpg",
  },
  {
    id: "financial-services-and-bank",
    folderName: "Financial Services and bank",
    name: "Financial Services and bank",
    category: "Banking & Wealth",
    description: "Aurelia Finance — Wealth management, corporate banking, and investments.",
    thumbnail: "/template-thumbnails/financial-services-and-bank.jpg",
  },
  {
    id: "it-company",
    folderName: "IT Company",
    name: "IT Company",
    category: "Technology & Software",
    description: "SaaSify — Enterprise cloud software, intelligent tools, and SaaS solutions.",
    thumbnail: "/template-thumbnails/it-company.jpg",
  },
  {
    id: "interior-design",
    folderName: "Interior Design",
    name: "Interior Design",
    category: "Interior & Living",
    description: "SAVOYE — Luxury residential interiors, bespoke furniture, and styling.",
    thumbnail: "/template-thumbnails/interior-design.jpg",
  },
  {
    id: "jewellery",
    folderName: "Jewellery",
    name: "Jewellery",
    category: "Luxury & Retail",
    description: "Valenza — Handcrafted bespoke fine jewellery, diamonds, and collections.",
    thumbnail: "/template-thumbnails/jewellery.jpg",
  },
  {
    id: "ngo",
    folderName: "NGO",
    name: "NGO",
    category: "Nonprofit & Charity",
    description: "HopeRise — Global charity foundation, volunteer campaigns, and impact.",
    thumbnail: "/template-thumbnails/ngo.jpg",
  },
  {
    id: "solar-company",
    folderName: "Solar Company",
    name: "Solar Company",
    category: "Renewable Energy",
    description: "Premium Solar — Clean renewable energy, residential and industrial solar.",
    thumbnail: "/template-thumbnails/solar-company.jpg",
  },
  {
    id: "spa-and-wellness",
    folderName: "Spa and Wellness",
    name: "Spa and Wellness",
    category: "Wellness & Spa",
    description: "Serenity Spa — Holistic therapy, relaxation sanctuary, and wellness packages.",
    thumbnail: "/template-thumbnails/spa-and-wellness.jpg",
  },
  {
    id: "dancer",
    folderName: "dancer",
    name: "dancer",
    category: "Performing Arts",
    description: "Elena Rostova — Soloist contemporary dancer portfolio, tours, and media.",
    thumbnail: "/template-thumbnails/dancer.jpg",
  },
  {
    id: "fitness",
    folderName: "fitness",
    name: "fitness",
    category: "Fitness & Training",
    description: "APEX Performance — Elite athletic conditioning, sports gym, and recovery.",
    thumbnail: "/template-thumbnails/fitness.jpg",
  },
  {
    id: "insurance",
    folderName: "insurance",
    name: "insurance",
    category: "Insurance & Risk",
    description: "Aegis Crest — Institutional risk protection, family, and health coverage.",
    thumbnail: "/template-thumbnails/insurance.jpg",
  },
  {
    id: "photography",
    folderName: "photography",
    name: "photography",
    category: "Photography & Arts",
    description: "SJ Photography — High-fashion editorial photography, shoots, and gallery.",
    thumbnail: "/template-thumbnails/photography.jpg",
  },
  {
    id: "yoga",
    folderName: "yoga",
    name: "yoga",
    category: "Mindfulness & Yoga",
    description: "Aria Veda — Somatic yoga, guided meditation, and holistic retreat studio.",
    thumbnail: "/template-thumbnails/yoga.jpg",
  },
];

export function AIBuiltTemplatesShowcase() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const scrollPositionRef = useRef<number>(0);

  const handleClosePreview = useCallback(() => {
    setSelectedTemplate(null);
  }, []);

  const handleOpenPreview = (template: TemplateItem) => {
    if (typeof window !== "undefined") {
      scrollPositionRef.current = window.scrollY;
    }
    setSelectedTemplate(template);
  };

  // Close full-screen preview with ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedTemplate) {
        handleClosePreview();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTemplate, handleClosePreview]);

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

  // Duplicated set for seamless continuous horizontal loop
  const displayItems = [...TEMPLATES_DATA, ...TEMPLATES_DATA];

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

          {/* Marquee Controls & Status Pill */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>17 Real Templates</span>
            </div>

            <button
              type="button"
              onClick={() => setIsManuallyPaused((prev) => !prev)}
              aria-label={isManuallyPaused ? "Resume scrolling" : "Pause scrolling"}
              className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-purple-600 transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              {isManuallyPaused ? (
                <>
                  <Play className="w-4 h-4 text-purple-600" />
                  <span className="hidden sm:inline">Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Marquee Horizontal Carousel Outer Container */}
      <div
        className="relative w-full overflow-hidden py-4"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Left & Right Subtle Fade Overlays for Seamless Edge Visuals */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 sm:w-20 md:w-32 bg-gradient-to-r from-white via-white/80 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 sm:w-20 md:w-32 bg-gradient-to-l from-white via-white/80 to-transparent z-10" />

        {/* Scrolling Inner Track: responsive widths ensuring 4 cards visible on desktop, 2 on tablet, 1 on mobile */}
        <div
          className="flex gap-6 w-max select-none"
          style={{
            animation: "codeaxys-marquee 90s linear infinite",
            animationPlayState: isHovered || isManuallyPaused ? "paused" : "running",
            willChange: "transform",
          }}
        >
          {displayItems.map((template, idx) => (
            <div
              key={`${template.id}-${idx}`}
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
                  priority={idx < 4}
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
          ))}
        </div>
      </div>

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
          className="fixed inset-0 z-[9999] w-screen h-screen bg-white overflow-hidden animate-in fade-in duration-200"
        >
          {/* Minimal, unobtrusive floating Close button at top-right corner */}
          <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[10000]">
            <button
              type="button"
              onClick={handleClosePreview}
              aria-label="Close preview"
              className="group flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 hover:bg-slate-950 text-white backdrop-blur-md shadow-2xl border border-white/20 text-xs font-bold transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span>Close</span>
              <X className="w-4 h-4 text-slate-300 group-hover:text-white transition-colors" />
            </button>
          </div>

          {/* Full-screen isolated template iframe */}
          <iframe
            ref={iframeRef}
            src={previewUrl}
            title={`${selectedTemplate.name} Website Preview`}
            className="w-full h-full border-0 block"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        </div>
      )}
    </section>
  );
}
