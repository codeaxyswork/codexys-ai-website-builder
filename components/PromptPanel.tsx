"use client";

import React, { useState } from "react";
import {
  Wand2,
  RefreshCw,
  AlertTriangle,
  Layers,
  Palette,
  Type,
  Layout,
  Send,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { WebsitePlan } from "@/lib/types";

interface PromptPanelProps {
  prompt: string;
  setPrompt: (p: string) => void;
  onGenerate: () => void;
  onEdit: (instruction: string) => void;
  isGenerating: boolean;
  isEditing: boolean;
  generationStage: "idle" | "planning" | "generating" | "complete" | "error";
  plan: WebsitePlan | null;
  error: string | null;
}

export function PromptPanel({
  prompt,
  setPrompt,
  onGenerate,
  onEdit,
  isGenerating,
  isEditing,
  generationStage,
  plan,
  error,
}: PromptPanelProps) {
  const [editInstruction, setEditInstruction] = useState("");

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInstruction.trim() || isEditing || isGenerating) return;
    onEdit(editInstruction);
    setEditInstruction("");
  };

  return (
    <div className="w-full lg:w-96 border-r border-slate-800 bg-slate-950 flex flex-col h-full overflow-hidden shrink-0">
      <div className="p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1">
        {/* Prompt Input Header */}
        <div>
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between mb-2">
            <span>Website Prompt</span>
            <span className="text-[10px] text-slate-500 font-normal">Stage 1 & 2</span>
          </label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your website... (e.g. 'Create a premium luxury car showroom website called Velocity Motors.')"
              rows={4}
              disabled={isGenerating || isEditing}
              className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 outline-none resize-none transition-all disabled:opacity-50"
            />
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onGenerate}
          disabled={!prompt.trim() || isGenerating || isEditing}
          className="w-full py-3 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 active:scale-[0.99] transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>
                {generationStage === "planning"
                  ? "Stage 1: Planning Design..."
                  : "Stage 2: Generating Code..."}
              </span>
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              <span>Generate Website</span>
            </>
          )}
        </button>

        {/* Real API Error Message */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/80 text-red-300 flex items-start gap-2.5 text-xs animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block text-red-200 mb-0.5">Generation Error</span>
              <p className="text-red-300/90 leading-relaxed break-words">{error}</p>
            </div>
          </div>
        )}

        {/* Generation Stage Progress Tracker */}
        {isGenerating && (
          <div className="p-3.5 rounded-xl border border-indigo-800/80 bg-indigo-950/40 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              <span>Generating with Codexys AI Engine...</span>
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className={generationStage === "planning" ? "text-indigo-400 font-medium flex items-center gap-1" : "text-emerald-400 flex items-center gap-1"}>
                  {generationStage === "planning" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  1. Codexys Design Planning
                </span>
                <span className="text-slate-500">
                  {generationStage === "planning" ? "Active" : "Done"}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div className={`h-full bg-indigo-500 transition-all duration-500 ${generationStage === "planning" ? "w-1/2" : "w-full"}`} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className={generationStage === "generating" ? "text-purple-400 font-medium flex items-center gap-1" : generationStage === "complete" ? "text-emerald-400 flex items-center gap-1" : "text-slate-500 flex items-center gap-1"}>
                  {generationStage === "generating" ? <Loader2 className="w-3 h-3 animate-spin" /> : generationStage === "complete" ? <CheckCircle2 className="w-3 h-3" /> : "2. HTML / CSS Code Gen"}
                  {generationStage === "generating" && "2. HTML / CSS Code Gen"}
                </span>
                <span className="text-slate-500">
                  {generationStage === "generating" ? "Active" : generationStage === "complete" ? "Done" : "Pending"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* AI Website Design Plan */}
        {plan && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden flex flex-col gap-3 p-3.5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Design Architecture</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] rounded bg-indigo-500/10 text-indigo-300 font-mono">
                {plan.websiteType || "Custom"}
              </span>
            </div>

            {/* Brand Identity & Visual Direction */}
            <div className="space-y-2 text-xs">
              {plan.brandIdentity && (
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Brand Identity</span>
                  <p className="text-slate-200 font-medium text-xs">{plan.brandIdentity}</p>
                </div>
              )}

              {plan.designDirection && (
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Visual Direction</span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{plan.designDirection}</p>
                </div>
              )}
            </div>

            {/* Color Palette Tags */}
            {plan.colorPalette && plan.colorPalette.length > 0 && (
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1.5 flex items-center gap-1">
                  <Palette className="w-3 h-3 text-pink-400" /> Color Direction
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {plan.colorPalette.map((col, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: col.hex }}
                      />
                      <span>{col.name}</span>
                      <span className="font-mono text-[9px] text-slate-500">{col.hex}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section Breakdown */}
            {plan.sections && plan.sections.length > 0 && (
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1.5 flex items-center gap-1">
                  <Layout className="w-3 h-3 text-purple-400" /> Section Outline ({plan.sections.length})
                </span>
                <div className="space-y-1">
                  {plan.sections.map((sec, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60 text-[11px]"
                    >
                      <span className="font-medium text-slate-200">{sec.name}</span>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{sec.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Follow-up Refinement Input */}
        {plan && (
          <div className="mt-auto border-t border-slate-800/80 pt-3">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
              Refine & Edit Website
            </label>
            <form onSubmit={handleEditSubmit} className="flex flex-col gap-2">
              <input
                type="text"
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                placeholder="e.g. 'Make hero more luxurious', 'Change colors to black and gold'"
                disabled={isEditing || isGenerating}
                className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!editInstruction.trim() || isEditing || isGenerating}
                className="w-full py-2 px-3 rounded-lg font-medium text-xs text-white bg-slate-800 hover:bg-slate-700 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 border border-slate-700"
              >
                {isEditing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Applying Edits...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-purple-400" />
                    <span>Refine Website Code</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
