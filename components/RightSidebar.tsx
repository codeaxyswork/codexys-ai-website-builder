"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Wand2,
  Code2,
  Settings,
  Send,
  Loader2,
  Copy,
  Check,
  FileCode,
  FileText,
  FileJson,
  Palette,
  ChevronRight,
  Sliders,
  ShieldCheck,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Mic,
  MicOff,
  Paperclip,
  X,
  Languages,
} from "lucide-react";
import { GeneratedFile, WebsitePlan, UploadedImage } from "@/lib/types";
import { SUPPORTED_LANGUAGES, getLanguageConfig } from "@/lib/multilingual";

interface RightSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  files: GeneratedFile[];
  plan: WebsitePlan | null;
  onEdit: (instruction: string, conversationLang?: string) => void;
  isEditing: boolean;
  isGenerating: boolean;
  uploadedImages: UploadedImage[];
  onAddImages: (files: FileList | null) => void;
  onRemoveImage: (id: string) => void;
}

export function RightSidebar({
  isOpen,
  onToggle,
  files,
  plan,
  onEdit,
  isEditing,
  isGenerating,
  uploadedImages,
  onAddImages,
  onRemoveImage,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "code" | "settings">("edit");
  const [editInstruction, setEditInstruction] = useState("");
  const [selectedFile, setSelectedFile] = useState<string>("index.html");
  const [copied, setCopied] = useState<boolean>(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string>("auto");
  const isListeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const initialInstructionRef = useRef(editInstruction);
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

  const editSuggestions = [
    "Make the hero section darker and cinematic",
    "Change primary accent color to purple & gold",
    "Add a customer testimonials grid section",
    "Include a contact form with modern inputs",
    "Make the mobile layout more spacious",
  ];

  useEffect(() => {
    if (!isListening) {
      initialInstructionRef.current = editInstruction;
    }
  }, [editInstruction, isListening]);

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
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    initialInstructionRef.current = editInstruction;
    accumulatedTextRef.current = "";

    const createRecognition = () => {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;

        if (selectedLang === "auto") {
          const detectedLang =
            (navigator.languages && navigator.languages.length ? navigator.languages[0] : null) ||
            navigator.language ||
            "";
          if (detectedLang) {
            recognition.lang = detectedLang;
          }
        } else {
          recognition.lang = selectedLang;
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
            const newInstruction = initialInstructionRef.current
              ? `${initialInstructionRef.current} ${combinedTranscript}`
              : combinedTranscript;
            setEditInstruction(newInstruction);
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

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInstruction.trim() || isEditing || isGenerating) return;
    onEdit(editInstruction, selectedLang);
    setEditInstruction("");
  };

  const handleSuggestionClick = (sug: string) => {
    setEditInstruction(sug);
  };

  // Code Tab Logic
  const fileOptions = [
    ...files.map((f) => f.path),
    ...(plan ? ["plan.json"] : []),
  ];

  let activeContent = "";
  if (selectedFile === "plan.json" && plan) {
    activeContent = JSON.stringify(plan, null, 2);
  } else {
    activeContent =
      files.find((f) => f.path === selectedFile)?.content ||
      "// No code generated yet";
  }

  const handleCopy = () => {
    if (!activeContent) return;
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith(".html")) return <FileCode className="w-3.5 h-3.5 text-orange-500" />;
    if (fileName.endsWith(".css")) return <FileText className="w-3.5 h-3.5 text-blue-500" />;
    if (fileName.endsWith(".js")) return <Code2 className="w-3.5 h-3.5 text-amber-500" />;
    if (fileName.endsWith(".json")) return <FileJson className="w-3.5 h-3.5 text-purple-600" />;
    return <FileText className="w-3.5 h-3.5 text-slate-500" />;
  };

  const lines = activeContent.split("\n");

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        title="Open Workspace Panel"
        className="absolute right-4 top-20 z-30 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-lg transition-all flex items-center gap-2 text-xs font-medium"
      >
        <PanelRightOpen className="w-4 h-4 text-purple-600" />
        <span className="hidden sm:inline">Inspect & Edit</span>
      </button>
    );
  }

  return (
    <div className="w-full lg:w-96 border-l border-slate-200 bg-white flex flex-col h-full overflow-hidden shrink-0 relative transition-all duration-300 z-20 shadow-xs">
      {/* Top Header Tabs & Collapse Button */}
      <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab("edit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "edit"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>AI Edit</span>
          </button>

          <button
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "code"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Code</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "settings"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>

        <button
          onClick={onToggle}
          title="Collapse Panel"
          className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      {/* Tab 1: AI Edit */}
      {activeTab === "edit" && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto custom-scrollbar gap-5 bg-white">
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Refine with AI Instructions</span>
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              Describe what you want to modify, and Codexys AI will update your code.
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              {/* Separate Voice Language & Mic Controls Bar (Outside Textarea) */}
              <div className="flex items-center justify-between gap-1 pb-1.5 px-0.5 border-b border-slate-100">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Languages className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-700 shrink-0">AI Lang:</span>
                  <select
                    value={selectedLang}
                    onChange={(e) => handleLangSelect(e.target.value)}
                    disabled={isListening || isEditing}
                    className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-800 rounded-lg px-2 py-1 outline-none focus:border-purple-500 transition-all cursor-pointer truncate max-w-[130px]"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isEditing || isGenerating || files.length === 0}
                  title={isListening ? "Listening... Click mic to stop" : "Speak instruction in native script (voice input)"}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                    isListening
                      ? "bg-red-50 text-red-600 border-red-300 animate-pulse shadow-xs ring-2 ring-red-400/30 font-semibold"
                      : "bg-slate-50 text-slate-700 hover:text-purple-600 hover:bg-purple-50 border-slate-200"
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-3.5 h-3.5" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 text-purple-600" />
                      <span>Voice</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <textarea
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  placeholder="e.g. 'Make hero section darker', 'Change button to purple'"
                  rows={4}
                  disabled={isEditing || isGenerating || files.length === 0}
                  className="w-full bg-white border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 outline-none resize-none transition-all disabled:opacity-50"
                />
              </div>

              {/* Voice Listening Active Badge */}
              {isListening && (
                <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px] font-medium animate-pulse">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block shrink-0" />
                    <span>Listening... Speak naturally.</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopListening}
                    className="text-[10px] font-bold underline hover:text-red-900 ml-1"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Uploaded Images List in Sidebar */}
              {uploadedImages.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {uploadedImages.map((img) => (
                    <div
                      key={img.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-purple-200 bg-purple-50/80 text-[11px] text-purple-900 font-medium"
                    >
                      <img src={img.dataUrl} alt={img.name} className="w-4 h-4 object-cover rounded" />
                      <span className="max-w-[100px] truncate">{img.name}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveImage(img.id)}
                        className="text-purple-600 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
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
                  disabled={isEditing || isGenerating || files.length === 0}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-purple-50 text-[11px] font-medium text-slate-700 hover:text-purple-700 transition-all"
                >
                  <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                  <span>Attach Image</span>
                </button>

                <button
                  type="submit"
                  disabled={!editInstruction.trim() || isEditing || isGenerating || files.length === 0}
                  className="flex-1 py-2 px-3 rounded-xl font-semibold text-xs text-white bg-purple-600 hover:bg-purple-700 active:scale-[0.99] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isEditing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Applying...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Apply Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Quick Edit Suggestions */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Quick Suggestions
            </span>
            <div className="flex flex-col gap-1.5">
              {editSuggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(sug)}
                  disabled={isEditing || isGenerating}
                  className="text-left text-xs px-3 py-2 rounded-xl bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-200 text-slate-700 hover:text-purple-900 transition-all flex items-center justify-between group"
                >
                  <span className="truncate">{sug}</span>
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-purple-600 shrink-0 ml-1" />
                </button>
              ))}
            </div>
          </div>

          {/* AI Design Plan Metadata Summary */}
          {plan && (
            <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" />
                  <span>Design Architecture</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                  {plan.websiteType || "Custom"}
                </span>
              </div>

              {plan.colorPalette && plan.colorPalette.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Color Tokens</span>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.colorPalette.map((col, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-slate-200 text-[10px] text-slate-700"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                          style={{ backgroundColor: col.hex }}
                        />
                        <span>{col.name}</span>
                        <span className="font-mono text-[9px] text-slate-400">{col.hex}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Code Inspection */}
      {activeTab === "code" && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* File Tab Selector & Actions */}
          <div className="h-12 border-b border-slate-200 px-3 flex items-center justify-between shrink-0 bg-slate-50 overflow-x-auto custom-scrollbar">
            <div className="flex items-center gap-1">
              {fileOptions.map((fileName) => (
                <button
                  key={fileName}
                  onClick={() => setSelectedFile(fileName)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    selectedFile === fileName
                      ? "bg-white text-slate-900 border border-slate-200 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
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
                title="Copy code"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all disabled:opacity-40"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Clean Formatted Code Viewer */}
          <div className="flex-1 overflow-auto bg-slate-900 font-mono text-xs p-3 text-slate-100 leading-relaxed custom-scrollbar">
            {files.length === 0 && !plan ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 p-6 text-center">
                <Code2 className="w-8 h-8 text-slate-600" />
                <p className="text-xs">Generated website code will appear here after prompt execution.</p>
              </div>
            ) : (
              <div className="table w-full">
                {lines.map((line, idx) => (
                  <div key={idx} className="table-row hover:bg-slate-800/60 rounded">
                    <span className="table-cell select-none pr-4 text-right text-slate-500 text-[10px] w-8">
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
      )}

      {/* Tab 3: Settings */}
      {activeTab === "settings" && (
        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-6 bg-white">
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-purple-600" />
              <span>Workspace Settings</span>
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              Configure options and platform settings.
            </p>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-xs font-semibold text-slate-800 block flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Codexys AI Engine</span>
                </span>
                <div className="space-y-1 text-[11px] text-slate-600">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>Model Engine</span>
                    <span className="font-mono text-slate-900">Codexys AI v3</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>Brand Architecture</span>
                    <span className="font-mono text-purple-700">Codexys AI Platform</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Sandbox Security</span>
                    <span className="font-mono text-slate-900">Isolated iframe</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
