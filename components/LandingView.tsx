"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Wand2,
  Sparkles,
  ArrowRight,
  Car,
  Stethoscope,
  Utensils,
  Briefcase,
  Shield,
  Zap,
  Mic,
  MicOff,
  Paperclip,
  X,
  Languages,
  Eye,
  Globe,
  Sliders,
  CheckCircle2,
  Search,
  ChevronRight,
  FolderOpen,
  HelpCircle,
  FileCode,
  Layout,
  Layers,
  BarChart3,
  ShieldCheck,
  Building2,
  Code2,
  UserCheck,
  Rocket,
} from "lucide-react";
import { UploadedImage } from "@/lib/types";
import { SUPPORTED_LANGUAGES, getLanguageConfig } from "@/lib/multilingual";

interface LandingViewProps {
  prompt: string;
  setPrompt: (p: string) => void;
  onGenerate: (conversationLang?: string) => void;
  onSelectSamplePrompt: (sample: string) => void;
  isGenerating: boolean;
  error: string | null;
  uploadedImages: UploadedImage[];
  onAddImages: (files: FileList | null) => void;
  onRemoveImage: (id: string) => void;
}

const DEFAULT_SAMPLE_PROMPT = "Create a premium luxury car showroom website called Velocity Motors.";

export function LandingView({
  prompt,
  setPrompt,
  onGenerate,
  onSelectSamplePrompt,
  isGenerating,
  error,
  uploadedImages,
  onAddImages,
  onRemoveImage,
}: LandingViewProps) {
  const [isListening, setIsListening] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string>("auto");
  const isListeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const initialPromptRef = useRef(prompt);
  const accumulatedTextRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("codeaxys_conversation_lang");
      if (saved) {
        setSelectedLang(saved);
      }
    } catch (e) {}

    const handleLangEvent = (e: any) => {
      if (e.detail) {
        setSelectedLang(e.detail);
      }
    };
    window.addEventListener("codeaxys_lang_changed", handleLangEvent);
    return () => window.removeEventListener("codeaxys_lang_changed", handleLangEvent);
  }, []);

  const handleLangSelect = (code: string) => {
    setSelectedLang(code);
    try {
      localStorage.setItem("codeaxys_conversation_lang", code);
      window.dispatchEvent(new CustomEvent("codeaxys_lang_changed", { detail: code }));
    } catch (e) {}
  };

  const sampleChips = [
    {
      label: "Luxury Dental Clinic",
      icon: Stethoscope,
      prompt: "Create a serene, minimal luxury dental clinic website with appointment booking and services.",
    },
    {
      label: "Modern Restaurant",
      icon: Utensils,
      prompt: "Build an elegant modern Italian restaurant website with menu showcase and table reservation.",
    },
    {
      label: "Professional Business",
      icon: Briefcase,
      prompt: "Create a sleek professional AI consulting business website with pricing tiers and features grid.",
    },
    {
      label: "Luxury Car Showroom",
      icon: Car,
      prompt: DEFAULT_SAMPLE_PROMPT,
    },
    {
      label: "Kids Martial Arts Academy",
      icon: Shield,
      prompt: "Create a colorful and energetic website for a kids martial arts academy with schedule and programs.",
    },
    {
      label: "Creative Agency",
      icon: Wand2,
      prompt: "Design a bold modern digital creative agency portfolio website with hero video showcase and case studies.",
    },
  ];

  // Sync initial prompt when not listening
  useEffect(() => {
    if (!isListening) {
      initialPromptRef.current = prompt;
    }
  }, [prompt, isListening]);

  const stopListening = () => {
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. You can type your website description.");
      return;
    }

    const isDefaultOrSample =
      !prompt.trim() ||
      prompt.trim() === DEFAULT_SAMPLE_PROMPT ||
      prompt.includes("Velocity Motors");

    const basePrompt = isDefaultOrSample ? "" : prompt;
    initialPromptRef.current = basePrompt;
    setPrompt(basePrompt);
    accumulatedTextRef.current = "";

    const createRecognition = () => {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;

        const langCfg = getLanguageConfig(selectedLang);
        if (langCfg.sttLocale) {
          recognition.lang = langCfg.sttLocale;
        } else {
          const detectedLang =
            (navigator.languages && navigator.languages.length ? navigator.languages[0] : null) ||
            navigator.language ||
            "en-US";
          recognition.lang = detectedLang;
        }

        recognition.onstart = () => {
          isListeningRef.current = true;
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            if (result.isFinal) {
              accumulatedTextRef.current += (accumulatedTextRef.current ? " " : "") + result[0].transcript.trim();
            } else {
              interimTranscript += result[0].transcript;
            }
          }

          const combinedTranscript = (accumulatedTextRef.current + " " + interimTranscript).trim();
          if (combinedTranscript) {
            const newPrompt = initialPromptRef.current
              ? `${initialPromptRef.current} ${combinedTranscript}`
              : combinedTranscript;
            setPrompt(newPrompt);
          }
        };

        recognition.onerror = (event: any) => {
          if (event.error === "no-speech") return;
          if (event.error === "aborted" || event.error === "not-allowed") {
            stopListening();
          }
        };

        recognition.onend = () => {
          if (isListeningRef.current) {
            try {
              recognition.start();
            } catch (e) {
              setTimeout(() => {
                if (isListeningRef.current) createRecognition();
              }, 200);
            }
          } else {
            setIsListening(false);
          }
        };

        recognition.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
        stopListening();
      }
    };

    createRecognition();
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddImages(e.target.files);
      e.target.value = "";
    }
  };

  const scrollToGenerator = () => {
    const el = document.getElementById("hero-generator");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="w-full bg-slate-50 text-slate-900 font-sans">
      {/* SECTION 1: HERO SECTION */}
      <section id="hero-generator" className="relative pt-8 sm:pt-12 pb-16 px-4 sm:px-8 flex flex-col items-center justify-center bg-white border-b border-slate-200/80 overflow-hidden">
        {/* Subtle Futuristic Animated Background System */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
          {/* Faint Technical Dot Grid Pattern with Mask Fade */}
          <div className="absolute inset-0 bg-[radial-gradient(#9333ea_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.14] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)]" />

          {/* Floating Ambient Light Glow Orbs */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-purple-200/35 via-indigo-100/45 to-cyan-100/30 rounded-full blur-3xl animate-float-slow-1" />
          <div className="absolute top-1/3 left-1/3 -translate-x-1/2 w-[450px] h-[320px] bg-purple-300/20 rounded-full blur-3xl animate-float-slow-2" />
          <div className="absolute top-1/2 right-1/4 w-[400px] h-[300px] bg-indigo-200/25 rounded-full blur-3xl animate-float-slow-1" />

          {/* Quiet AI Node Pulse Dots Overlaid on Grid Intersections */}
          <div className="absolute top-[22%] left-[18%] sm:left-[28%] w-2 h-2 rounded-full bg-purple-600 animate-ai-pulse-1 shadow-sm shadow-purple-500" />
          <div className="absolute top-[35%] right-[15%] sm:right-[26%] w-2 h-2 rounded-full bg-indigo-600 animate-ai-pulse-2 shadow-sm shadow-indigo-500" />
          <div className="absolute top-[62%] left-[22%] sm:left-[32%] w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ai-pulse-3 shadow-sm shadow-cyan-400" />
          <div className="absolute top-[58%] right-[20%] sm:right-[30%] w-2 h-2 rounded-full bg-purple-500 animate-ai-pulse-1 shadow-sm shadow-purple-400" />
        </div>

        <div className="max-w-4xl w-full flex flex-col items-center text-center space-y-6">
          {/* AI Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-50 border border-purple-200/90 text-purple-700 text-xs font-bold tracking-wide shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>✦ AI-Powered Website Builder</span>
          </div>

          {/* Headline & Subtitle */}
          <div className="space-y-3 max-w-3xl">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.15]">
              Describe it.{" "}
              <span className="text-purple-600 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700">
                Watch it become a website.
              </span>
            </h1>
            <p className="text-slate-600 text-sm sm:text-lg font-normal leading-relaxed max-w-2xl mx-auto">
              Turn your idea into a complete, responsive website with AI. Generate, edit, refine and publish — all from one powerful workspace.
            </p>
          </div>

          {/* AI Generator Interactive Elevated Card */}
          <div className="relative w-full max-w-4xl group text-left rounded-[28px] p-[2.5px] bg-purple-200/60 overflow-hidden shadow-2xl shadow-purple-950/20">
            {/* Vivid Travelling Purple/Violet Light Beam Edge around Entire Outer Box */}
            <div
              className="absolute inset-[-200%] animate-border-beam pointer-events-none"
              style={{
                background: "conic-gradient(from 0deg at 50% 50%, transparent 0%, transparent 45%, #a855f7 65%, #f3e8ff 80%, #7e22ce 92%, transparent 100%)",
              }}
            />

            {/* Elevated Product Card Container (Clean White Inside) */}
            <div className="relative w-full bg-white rounded-[26px] p-5 sm:p-7 shadow-xs">
              <div className="flex flex-col gap-4">
                {/* Voice Language & Mic Top Controls Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 bg-slate-50/70 p-2.5 sm:p-3 rounded-2xl border border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <Languages className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="text-xs font-semibold text-slate-700">AI Language:</span>
                    <select
                      value={selectedLang}
                      onChange={(e) => handleLangSelect(e.target.value)}
                      disabled={isListening || isGenerating}
                      className="bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-xl px-3 py-1.5 outline-none focus:border-purple-500 transition-all cursor-pointer shadow-2xs max-w-[180px] sm:max-w-none truncate"
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Compact Inline Active Recording Status Indicator */}
                    {isListening && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50/90 border border-red-200/90 text-red-700 text-xs font-semibold shadow-2xs">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        <span className="hidden sm:inline">Listening... Speak naturally.</span>
                        <span className="sm:hidden">Listening...</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={toggleListening}
                      disabled={isGenerating}
                      title={isListening ? "Listening... Click mic to stop" : "Speak naturally in your language (voice input)"}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        isListening
                          ? "bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-sm"
                          : "bg-white text-slate-700 hover:text-purple-700 hover:bg-purple-50 border-slate-200 shadow-2xs"
                      }`}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="w-3.5 h-3.5 text-white" />
                          <span>Stop Recording</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-purple-600" />
                          <span>Voice Input</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Textarea Prompt Focus Input Area */}
                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the website you want to create in detail... (e.g. 'Build a luxury dental clinic website with appointment booking, services grid, and patient reviews')"
                    rows={4}
                    disabled={isGenerating}
                    className="w-full bg-white border border-slate-200 focus:border-purple-600 focus:ring-4 focus:ring-purple-500/10 rounded-2xl p-4.5 sm:p-5 text-slate-900 placeholder-slate-400 outline-none resize-none transition-all text-sm sm:text-base font-sans leading-relaxed shadow-inner/5"
                  />
                </div>

                {/* Uploaded Images Thumbnail Chips */}
                {uploadedImages.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Attached Assets ({uploadedImages.length}):
                    </span>
                    {uploadedImages.map((img) => (
                      <div
                        key={img.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50/80 text-xs text-purple-900 font-semibold"
                      >
                        <img
                          src={img.dataUrl}
                          alt={img.name}
                          className="w-5 h-5 object-cover rounded-md border border-purple-300"
                        />
                        <span className="max-w-[120px] truncate">{img.name}</span>
                        <button
                          onClick={() => onRemoveImage(img.id)}
                          title="Remove image"
                          className="p-0.5 rounded hover:bg-purple-200 text-purple-600 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom Actions Row */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-xs font-semibold text-slate-700 hover:text-purple-700 transition-all cursor-pointer shadow-2xs"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                      <span>Attach Logo / Images</span>
                    </button>

                    <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 font-semibold px-3 py-1.5 bg-slate-100/80 rounded-xl border border-slate-200/50">
                      <Zap className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span>Instant HTML, CSS & JS</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onGenerate(selectedLang)}
                    disabled={!prompt.trim() || isGenerating}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-extrabold text-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-purple-600/25 hover:shadow-xl hover:shadow-purple-600/35 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shrink-0 cursor-pointer border border-purple-500/30"
                  >
                    <Wand2 className="w-4 h-4" />
                    <span>Generate Website</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="w-full p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs text-left">
              <p className="font-bold mb-0.5">Generation Error</p>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Example Prompt Chips */}
          <div className="w-full space-y-3 pt-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Not sure where to start? Try one of these example prompts:
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {sampleChips.map((chip, idx) => {
                const Icon = chip.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => onSelectSamplePrompt(chip.prompt)}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-slate-700 hover:text-purple-700 text-xs font-semibold transition-all shadow-2xs hover:shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Icon className="w-3.5 h-3.5 text-purple-600" />
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>


      {/* SECTION 2: HOW IT WORKS — FROM IDEA TO LIVE WEBSITE */}
      <section id="how-it-works" className="py-24 px-6 sm:px-12 bg-gradient-to-b from-slate-50 via-purple-50/20 to-slate-50 border-b border-slate-200/80 relative overflow-hidden">
        {/* Subtle background grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <div className="max-w-7xl mx-auto space-y-12 relative z-10">
          {/* Section Title Header */}
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 uppercase tracking-widest bg-purple-100/80 px-4 py-1.5 rounded-full border border-purple-200/80 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" /> How It Works
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              From your idea to a <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-800 bg-clip-text text-transparent">live website.</span>
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed">
              Creating a website is simple. Tell us what you want, let AI build it, make changes anytime, and publish when you're ready.
            </p>
          </div>


          {/* Full-Width Interactive Workflow Visual Workspace Container */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xl shadow-purple-900/5 space-y-6">
            {/* Top Workspace Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="text-xs font-bold text-slate-600 ml-2 font-mono">codexys.ai/how-it-works</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-spin" /> Simple 4-Step Process
              </span>
            </div>

            {/* 4 Connected Feature Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Module 1: Share Your Idea */}
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 text-white space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-purple-400 font-bold text-xs mb-2">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Step 1
                    </span>
                    <span className="bg-purple-500/20 text-purple-300 text-[10px] px-2 py-0.5 rounded border border-purple-500/30">
                      Share Idea
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Share Your Idea</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Type or speak what kind of website you want to create.
                  </p>
                </div>
                <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700 text-xs font-sans text-purple-200 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>“I need a website for my business...”</span>
                </div>
              </div>

              {/* Module 2: We Build Your Website */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-white space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-indigo-400 font-bold text-xs mb-2">
                    <span className="flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-indigo-400" /> Step 2
                    </span>
                    <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded border border-indigo-500/30">
                      AI Build
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">We Build Your Website</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Our AI creates your website based on your idea.
                  </p>
                </div>
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-xs font-sans space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Creating your website...</span>
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  </div>
                  <div className="text-emerald-400 font-semibold text-xs flex items-center justify-between">
                    <span>Website ready</span>
                    <span className="font-bold">✓</span>
                  </div>
                </div>
              </div>

              {/* Module 3: Make It Yours */}
              <div className="bg-purple-950/60 p-5 rounded-2xl border border-purple-800/60 text-white space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-purple-300 font-bold text-xs mb-2">
                    <span className="flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-purple-300" /> Step 3
                    </span>
                    <span className="bg-purple-500/20 text-purple-200 text-[10px] px-2 py-0.5 rounded border border-purple-500/30">
                      Customize
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Make It Yours</h4>
                  <p className="text-xs text-purple-200/80 mt-1 leading-relaxed">
                    Ask AI to change anything until the website looks exactly how you want.
                  </p>
                </div>
                <div className="bg-purple-900/80 p-3 rounded-xl border border-purple-700/60 text-xs font-sans space-y-1.5">
                  <div className="text-purple-200 text-[11px]">
                    “Make the design more premium”
                  </div>
                  <div className="text-emerald-300 font-semibold text-xs flex items-center justify-between">
                    <span>Changes applied</span>
                    <span className="font-bold">✓</span>
                  </div>
                </div>
              </div>

              {/* Module 4: Publish & Go Live */}
              <div className="bg-emerald-950 p-5 rounded-2xl border border-emerald-800 text-white space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-emerald-400 font-bold text-xs mb-2">
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" /> Step 4
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded border border-emerald-500/30">
                      Go Live
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Publish & Go Live</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Publish your website and connect your own domain when you're ready.
                  </p>
                </div>
                <div className="bg-emerald-900/80 p-3 rounded-xl border border-emerald-700/60 text-xs font-sans space-y-1.5">
                  <div className="text-emerald-200 font-mono text-[11px] truncate">
                    yourwebsite.com
                  </div>
                  <div className="text-emerald-300 font-semibold text-xs flex items-center justify-between">
                    <span>Website is live</span>
                    <span className="font-bold">✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: FEATURES / CAPABILITIES (BENTO GRID LAYOUT) */}
      <section id="features" className="py-24 px-6 sm:px-12 bg-white border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-widest bg-purple-100/70 px-3.5 py-1 rounded-full border border-purple-200">
              Platform Features
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Everything you need to go from idea to online.
            </h2>
            <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto font-medium">
              Built-in tools to design, customize, optimize and deploy complete web applications.
            </p>
          </div>

          {/* Premium 4-Card Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Bento Card 1: Multi-File Engine (6 Cols) */}
            <div className="md:col-span-6 bg-slate-50 p-8 rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/40 flex flex-col justify-between group hover:border-purple-300 transition-all duration-300">
              <div className="space-y-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
                  <Wand2 className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">Instant Multi-File Engine</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  Generates clean, production-ready HTML5, CSS3, and JavaScript code organized across dedicated files.
                </p>
              </div>

              {/* Mini UI Visual Showcase */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-purple-700 font-bold border-b border-slate-100 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Codexys AI Engine
                  </span>
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                    Production Ready
                  </span>
                </div>
                <div className="text-slate-600 text-[11px] space-y-1">
                  <p><span className="text-purple-600">✓</span> HTML5 semantic structure</p>
                  <p><span className="text-purple-600">✓</span> Responsive CSS grid & flexbox</p>
                  <p><span className="text-purple-600">✓</span> Interactive client-side JS logic</p>
                </div>
              </div>
            </div>

            {/* Bento Card 2: Sandboxed Live Preview Canvas (6 Cols) */}
            <div className="md:col-span-6 bg-slate-50 p-8 rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/40 flex flex-col justify-between group hover:border-purple-300 transition-all duration-300">
              <div className="space-y-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
                  <Eye className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">Sandboxed Live Preview Canvas</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  Test and inspect your website in real-time with responsive desktop and mobile sandbox viewports.
                </p>
              </div>

              {/* Browser Preview Window Mockup */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                  <span className="text-[10px] text-slate-400 font-mono ml-2">preview.codexys.site</span>
                </div>
                <div className="h-12 bg-slate-100 rounded-xl flex items-center justify-center text-xs font-bold text-slate-500">
                  Interactive Live Iframe Sandbox
                </div>
              </div>
            </div>

            {/* Bento Card 3: Supabase Media Manager (6 Cols) */}
            <div className="md:col-span-6 bg-slate-50 p-7 rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/40 flex flex-col justify-between group hover:border-purple-300 transition-all duration-300">
              <div className="space-y-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">Supabase Media Manager</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  Upload and reference your logos, brand images, and media assets stored securely in Supabase storage.
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Storage Bucket Connected
                </span>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-200">
                  PNG, JPG, SVG, WebP
                </span>
              </div>
            </div>

            {/* Bento Card 4: Subdomains & Custom DNS Publishing (6 Cols) */}
            <div className="md:col-span-6 bg-slate-50 p-7 rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/40 flex flex-col justify-between group hover:border-purple-300 transition-all duration-300">
              <div className="space-y-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">Subdomains & Custom DNS</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  Publish websites instantly with free `.codexys.site` subdomains or link your custom domain with free SSL.
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-2 font-mono text-[11px]">
                  yourbrand.codexys.site
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Auto SSL
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* SECTION 5: AI EDITING SHOWCASE */}
      <section className="py-24 px-6 sm:px-12 bg-gradient-to-b from-slate-50 via-purple-50/20 to-slate-50 border-b border-slate-200/80 relative overflow-hidden">
        {/* Subtle background grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <div className="max-w-7xl mx-auto space-y-12 relative z-10">
          {/* Header */}
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 uppercase tracking-widest bg-purple-100/80 px-4 py-1.5 rounded-full border border-purple-200/80 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Conversational Site Refinements
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Don't rebuild it. <br />
              <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-800 bg-clip-text text-transparent">
                Just ask AI to change it.
              </span>
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed">
              Refine typography, color themes, section layouts, and copy through simple natural language conversation in real-time.
            </p>
          </div>

          {/* Centered Mac-Style Dark AI Chat & Code Diff Studio IDE Window */}
          <div className="max-w-5xl mx-auto bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden text-white relative">
            {/* Ambient inner glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

            {/* IDE Window Titlebar */}
            <div className="bg-slate-900/90 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-bold text-slate-300 ml-3 font-mono">Codexys AI Interactive Editor — live_session.code</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800/60 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Realtime Diff Active
              </span>
            </div>

            {/* Split Screen Workspace: Left Chat Stream + Right Visual Code Diff */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-800">
              {/* Left Chat Conversation Feed (6 Cols) */}
              <div className="md:col-span-6 p-6 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block font-mono">AI Edit Stream</span>

                  {/* Message 1 */}
                  <div className="bg-purple-950/40 p-3.5 rounded-2xl border border-purple-800/40 text-xs">
                    <span className="text-[10px] font-bold text-purple-400 block mb-0.5">USER PROMPT</span>
                    <p className="text-white font-semibold">“Make hero background dark violet and add glowing CTA button.”</p>
                  </div>

                  {/* Message 1 AI Reply */}
                  <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-purple-300 font-bold text-[10px]">
                      <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Engine</span>
                      <span className="text-slate-400 font-mono">0.9s</span>
                    </div>
                    <p className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Re-compiled hero CSS with keyframe glow animation
                    </p>
                  </div>

                  {/* Message 2 */}
                  <div className="bg-purple-950/40 p-3.5 rounded-2xl border border-purple-800/40 text-xs">
                    <span className="text-[10px] font-bold text-purple-400 block mb-0.5">USER PROMPT</span>
                    <p className="text-white font-semibold">“Add a 3-tier pricing section right below features.”</p>
                  </div>

                  {/* Message 2 AI Reply */}
                  <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-purple-300 font-bold text-[10px]">
                      <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Engine</span>
                      <span className="text-slate-400 font-mono">1.1s</span>
                    </div>
                    <p className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Injected HTML &lt;section id="pricing"&gt; section
                    </p>
                  </div>
                </div>

                {/* Chat Input Box */}
                <div className="pt-2">
                  <div className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                    <input
                      type="text"
                      disabled
                      value="Ask AI to modify anything..."
                      className="bg-transparent text-xs text-slate-400 w-full focus:outline-none cursor-not-allowed"
                    />
                    <span className="p-1 rounded-lg bg-purple-600 text-white shrink-0">
                      <Zap className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Visual & Code Diff Viewer (6 Cols) */}
              <div className="md:col-span-6 p-6 space-y-4 bg-slate-900/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono">Live Code Diff Output</span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-mono">index.html</span>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-[11px] space-y-2 leading-relaxed text-slate-300 shadow-inner">
                    <p className="text-slate-500">// Realtime Code Modification Markers</p>
                    <p className="text-emerald-400 bg-emerald-950/40 p-1.5 rounded border border-emerald-900/40">
                      + &lt;section class="hero bg-slate-950 text-white"&gt;
                    </p>
                    <p className="text-purple-300 bg-purple-950/40 p-1.5 rounded border border-purple-900/40">
                      + &lt;button class="btn-glow animate-pulse"&gt;Get Started&lt;/button&gt;
                    </p>
                    <p className="text-emerald-400 bg-emerald-950/40 p-1.5 rounded border border-emerald-900/40">
                      + &lt;section id="pricing" class="grid grid-cols-3"&gt;
                    </p>
                  </div>
                </div>

                {/* 4 Feature Badges */}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                  <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/40 text-purple-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-purple-400" /> 1-Click Style Swap
                  </div>
                  <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-indigo-300 flex items-center gap-1.5">
                    <Layout className="w-3.5 h-3.5 text-indigo-400" /> Section Injector
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-800/40 text-blue-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" /> AI Copywriter
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Zero Tech Debt
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: SEO & GROWTH SUITE */}
      <section className="py-24 px-6 sm:px-12 bg-gradient-to-b from-white via-purple-50/20 to-slate-50 border-b border-slate-200/80 relative overflow-hidden">
        {/* Subtle background grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <div className="max-w-7xl mx-auto space-y-16 relative z-10">
          {/* Header */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 uppercase tracking-widest bg-purple-100/80 px-4 py-1.5 rounded-full border border-purple-200/80 shadow-xs">
              <Search className="w-3.5 h-3.5 text-purple-600" /> Search & Growth Suite
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Everything you need to help your <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-800 bg-clip-text text-transparent">
                website get discovered.
              </span>
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed max-w-2xl mx-auto">
              Show up on Google, track visitor growth, and connect your favorite analytics tools — automatically optimized and ready out of the box.
            </p>
          </div>

          {/* 4-Step Process Bar: Build -> Optimize -> Connect -> Track */}
          <div className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-md max-w-4xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
            <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-purple-50/70 border border-purple-100 text-xs font-bold text-slate-800">
              <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] flex items-center justify-center font-black">1</span>
              <span>Build Website</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs font-bold text-slate-800">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-black">2</span>
              <span>Auto-Optimize</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs font-bold text-slate-800">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-black">3</span>
              <span>Connect Tools</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs font-bold text-slate-800">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-black">4</span>
              <span>Track Growth</span>
            </div>
          </div>

          {/* Modern Product Dashboard Showcase Card */}
          <div className="bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6 text-white relative">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

            {/* Dashboard Top Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-bold text-slate-300 ml-2 font-mono">codexys.ai/dashboard/seo-growth</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800/60 font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Search Engine Sync Active
                </span>
              </div>
            </div>

            {/* Dashboard Core Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Widget: Search Visibility & Performance Metrics (7 cols) */}
              <div className="md:col-span-7 bg-slate-900/90 p-6 rounded-2xl border border-slate-800 space-y-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block font-mono">Search Overview</span>
                    <h4 className="text-base sm:text-lg font-bold text-white">Website Visibility & Speed</h4>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-800">
                    +142% Google Traffic
                  </span>
                </div>

                {/* Performance stats chips */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-medium block">Speed Score</span>
                    <span className="text-base sm:text-lg font-black text-emerald-400">98/100</span>
                    <span className="text-[9px] text-emerald-500 font-bold block">Fast Loading</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-medium block">Search Index</span>
                    <span className="text-base sm:text-lg font-black text-purple-400">Indexed</span>
                    <span className="text-[9px] text-purple-300 font-bold block">Sitemap Ready</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-medium block">SEO Score</span>
                    <span className="text-base sm:text-lg font-black text-blue-400">100%</span>
                    <span className="text-[9px] text-blue-300 font-bold block">Optimized</span>
                  </div>
                </div>

                {/* Google SERP Live Preview Box */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left space-y-1.5 shadow-inner">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1"><Search className="w-3 h-3 text-blue-400" /> Google Search Preview</span>
                    <span className="text-emerald-400 font-bold font-sans">Auto-Generated</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 font-mono truncate">https://yourwebsite.com</div>
                  <h5 className="text-xs sm:text-sm font-bold text-blue-400 hover:underline cursor-pointer">
                    Your Business Name | Best Services & Solutions
                  </h5>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Discover top-rated services, instant bookings, and professional solutions tailored for your business needs...
                  </p>
                </div>
              </div>

              {/* Right Widget: Social Preview & Key Capabilities (5 cols) */}
              <div className="md:col-span-5 bg-slate-900/90 p-6 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-indigo-400 font-bold text-xs mb-2">
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-indigo-400" /> Social Media Sharing
                    </span>
                    <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded border border-indigo-500/30 font-sans">
                      Social Card
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white">Social Sharing Preview</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Your website automatically looks stunning when shared on WhatsApp, LinkedIn, Twitter, or Facebook.
                  </p>
                </div>

                {/* Mini Social Card Preview */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="h-24 rounded-lg bg-gradient-to-r from-purple-900/60 via-indigo-900/60 to-purple-950/80 border border-purple-800/40 flex flex-col items-center justify-center text-center p-3 text-xs font-bold text-purple-200 space-y-1">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span>Your Business Website</span>
                  </div>
                  <div className="text-[11px] font-bold text-white truncate">Your Business — Professional Services</div>
                  <div className="text-[10px] text-slate-400 truncate">yourwebsite.com</div>
                </div>
              </div>
            </div>
          </div>

          {/* Dedicated Third-Party SEO Tool Integrations Panel */}
          <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/90 shadow-xl shadow-purple-900/5 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div className="space-y-1">
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block">Integrations & Analytics</span>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900">Connect the tools you already use.</h3>
                <p className="text-slate-600 text-xs sm:text-sm font-medium">
                  Track your website performance, discover SEO opportunities, and understand how people find your website.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 1-Click Connection
              </span>
            </div>

            {/* 4 Recognized Integration Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Integration 1: Google Search Console */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-purple-300 transition-all space-y-3 flex flex-col justify-between group">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold text-sm">
                    <Search className="w-5 h-5 text-blue-600" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Google Search Console</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Monitor Google search rankings, index status, and search traffic keywords.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-between text-[11px] font-bold text-blue-700">
                  <span>Ready to connect</span>
                  <span className="text-blue-500 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* Integration 2: Google Analytics (GA4) */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-purple-300 transition-all space-y-3 flex flex-col justify-between group">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold text-sm">
                    <BarChart3 className="w-5 h-5 text-amber-600" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Google Analytics (GA4)</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Understand visitor behavior, track traffic sources, and measure conversions.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-between text-[11px] font-bold text-amber-700">
                  <span>Instant tracking</span>
                  <span className="text-amber-500 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* Integration 3: Ahrefs */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-purple-300 transition-all space-y-3 flex flex-col justify-between group">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-black text-xs tracking-tighter">
                    ahrefs
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Ahrefs Integration</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Audit website health, monitor backlink growth, and find high-ranking keywords.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-between text-[11px] font-bold text-indigo-700">
                  <span>Keyword sync</span>
                  <span className="text-indigo-500 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>

              {/* Integration 4: Semrush */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-purple-300 transition-all space-y-3 flex flex-col justify-between group">
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center font-black text-xs tracking-tighter">
                    semrush
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Semrush Integration</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Analyze competitor strategies, track search visibility, and optimize content.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-between text-[11px] font-bold text-orange-700">
                  <span>Rank tracker</span>
                  <span className="text-orange-500 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </div>
          </div>

          {/* 7 User-Friendly Core Features Bento Grid */}
          <div className="space-y-6">
            <div className="text-center space-y-2 max-w-xl mx-auto">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">Built-in optimization out of the box</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                No plugins required — every website comes pre-configured for search engines and social platforms.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Feature 1 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-2 hover:border-purple-300 transition-all">
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center">
                  <Layout className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-extrabold text-slate-900">SEO-Friendly Structure</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  Clean layout designed for search engine crawlers to read and index effortlessly.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-2 hover:border-purple-300 transition-all">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-extrabold text-slate-900">Auto Titles & Descriptions</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  AI automatically generates page titles and descriptions to boost your click rates.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-2 hover:border-purple-300 transition-all">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
                  <Search className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-extrabold text-slate-900">Google Search Preview</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  See exactly how your website will look in Google search results before publishing.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-2 hover:border-purple-300 transition-all">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
                  <FileCode className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-extrabold text-slate-900">Automatic Sitemap</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  Generated sitemaps help Google discover and index all your new pages instantly.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-2 hover:border-purple-300 transition-all">
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-extrabold text-slate-900">Social Media Preview</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  Pre-configured social cards for rich link previews on WhatsApp, Twitter, and LinkedIn.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-2 hover:border-purple-300 transition-all">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-extrabold text-slate-900">Analytics & Tracking</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  Built-in tracking to monitor visitor count, page views, and top traffic sources.
                </p>
              </div>

              {/* Feature 7 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-2 hover:border-purple-300 transition-all sm:col-span-2 lg:col-span-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-100 text-cyan-600 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-extrabold text-slate-900">Website Speed & Performance Optimization</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  Ultra-fast page load times ensure higher Google ranking and a smooth experience for visitors.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: USE CASES */}
      <section className="py-24 px-6 sm:px-12 bg-slate-50 border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-widest bg-purple-100/70 px-3.5 py-1 rounded-full border border-purple-200">
              Target Audiences
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Built for people who want to move faster.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-7 bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/40 space-y-3 hover:border-purple-300 transition-all duration-300">
              <Building2 className="w-7 h-7 text-purple-600" />
              <h3 className="text-base font-extrabold text-slate-900">Businesses</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Launch your online presence faster with complete custom marketing websites.
              </p>
            </div>

            <div className="p-7 bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/40 space-y-3 hover:border-purple-300 transition-all duration-300">
              <Rocket className="w-7 h-7 text-indigo-600" />
              <h3 className="text-base font-extrabold text-slate-900">Agencies</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Build and manage multiple client websites efficiently in record time.
              </p>
            </div>

            <div className="p-7 bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/40 space-y-3 hover:border-purple-300 transition-all duration-300">
              <UserCheck className="w-7 h-7 text-blue-600" />
              <h3 className="text-base font-extrabold text-slate-900">Entrepreneurs</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Turn your startup ideas into real online web application experiences.
              </p>
            </div>

            <div className="p-7 bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/40 space-y-3 hover:border-purple-300 transition-all duration-300">
              <Code2 className="w-7 h-7 text-emerald-600" />
              <h3 className="text-base font-extrabold text-slate-900">Developers</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Start with AI-generated HTML, CSS and JavaScript and customize further.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: PRICING PREVIEW */}
      <section id="pricing" className="py-24 px-6 sm:px-12 bg-white border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-widest bg-purple-100/70 px-3.5 py-1 rounded-full border border-purple-200">
              Flexible Tiers
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Simple, transparent pricing.
            </h2>
            <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto font-medium">
              Start building for free with 50 credits, upgrade as your business grows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Free</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900">₹0</span>
                  <span className="text-xs text-slate-500 font-semibold">/ month</span>
                </div>
                <ul className="space-y-2.5 pt-4 text-xs font-semibold text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> 50 AI Credits
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> 1 Website Limit
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> 100 MB Storage
                  </li>
                </ul>
              </div>
              <button
                onClick={scrollToGenerator}
                className="w-full mt-8 py-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer text-center"
              >
                Get Started Free
              </button>
            </div>

            {/* Pro Plan - Most Popular */}
            <div className="bg-white p-8 rounded-3xl border-2 border-purple-600 shadow-2xl relative flex flex-col justify-between">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                Most Popular
              </span>
              <div className="space-y-4">
                <span className="text-xs font-black uppercase tracking-wider text-purple-700">Pro</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900">₹999</span>
                  <span className="text-xs text-slate-500 font-semibold">/ month</span>
                </div>
                <ul className="space-y-2.5 pt-4 text-xs font-semibold text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> 500 AI Credits
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> 10 Websites
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> 5 GB Storage
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> AI SEO Engine
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> Custom Domain Support
                  </li>
                </ul>
              </div>
              <Link
                href="/pricing"
                className="w-full mt-8 py-3.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/20 text-center block"
              >
                Upgrade to Pro
              </Link>
            </div>

            {/* Agency Plan */}
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Agency</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900">₹2,999</span>
                  <span className="text-xs text-slate-500 font-semibold">/ month</span>
                </div>
                <ul className="space-y-2.5 pt-4 text-xs font-semibold text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> 2,000 AI Credits
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> 50 Websites
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> 20 GB Storage
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> Advanced Integrations
                  </li>
                </ul>
              </div>
              <Link
                href="/pricing"
                className="w-full mt-8 py-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold rounded-xl transition-all text-center block"
              >
                View Full Pricing →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 9: FINAL CTA */}
      <section className="py-28 px-6 sm:px-12 bg-slate-950 text-white relative overflow-hidden border-t border-slate-800">
        {/* Ambient Radial Glows */}
        <div className="absolute top-1/2 -left-20 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 -right-20 -translate-y-1/2 w-96 h-96 bg-cyan-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10">
          <div className="bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/90 backdrop-blur-xl rounded-3xl p-8 sm:p-14 shadow-2xl text-center space-y-8 relative overflow-hidden">
            {/* Top Pill */}
            <div className="flex items-center justify-center">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-widest bg-purple-500/15 border border-purple-500/30 px-4 py-1.5 rounded-full shadow-inner">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Start Building Today
              </span>
            </div>

            {/* Headline */}
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-6xl font-black tracking-tight leading-tight text-white">
                Your next website <br />
                <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
                  starts with an idea.
                </span>
              </h2>
              <p className="text-slate-300 text-sm sm:text-lg max-w-xl mx-auto font-medium leading-relaxed">
                Tell Codexys what you want to build and let AI create clean, production-ready code in seconds.
              </p>
            </div>

            {/* Main Action Button */}
            <div className="pt-2 flex flex-col items-center gap-4">
              <button
                onClick={scrollToGenerator}
                className="px-9 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white font-extrabold text-sm sm:text-base rounded-2xl hover:brightness-110 transition-all shadow-xl shadow-purple-600/30 flex items-center gap-3 cursor-pointer hover:scale-105 active:scale-95 group"
              >
                <Wand2 className="w-5 h-5 text-white group-hover:rotate-12 transition-transform" />
                <span>Start Building for Free →</span>
              </button>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 font-semibold pt-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> 50 Free AI Credits
                </span>
                <span className="text-slate-700">•</span>
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-purple-400" /> Instant Generation (&lt; 10s)
                </span>
                <span className="text-slate-700">•</span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Free Subdomain & SSL
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 10: FOOTER */}
      <footer className="bg-slate-950 text-slate-400 py-16 px-6 sm:px-12 border-t border-slate-800">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="space-y-4">
            <img
              src="/logo.png"
              alt="Codexys Logo"
              className="h-7 w-auto object-contain brightness-200"
            />
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Codexys AI Website Builder SaaS. Generate, edit, refine, and publish full web applications with AI.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <button onClick={() => scrollToGenerator()} className="hover:text-white transition-colors cursor-pointer">
                  AI Generator
                </button>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Resources</h4>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <a href="mailto:support@codexys.site" className="hover:text-white transition-colors">
                  Support Email
                </a>
              </li>
              <li>
                <span className="text-slate-500">API Documentation</span>
              </li>
              <li>
                <span className="text-slate-500">System Status</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Account</h4>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-white transition-colors">
                  Customer Dashboard
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-white transition-colors">
                  Admin Panel
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} Codexys AI. All rights reserved.</p>
          <p>Powered by Gemini 3.6 Flash Engine</p>
        </div>
      </footer>
    </div>
  );
}
