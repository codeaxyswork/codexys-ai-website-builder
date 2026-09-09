"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

interface GenerationModalProps {
  isOpen: boolean;
  stage: "idle" | "planning" | "generating" | "complete" | "error";
}

export function GenerationModal({ isOpen, stage }: GenerationModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const steps = [
    { label: "Understanding your idea...", durationMs: 1500 },
    { label: "Designing your website...", durationMs: 3000 },
    { label: "Creating your layout...", durationMs: 4500 },
    { label: "Generating your website...", durationMs: 8000 },
  ];

  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, 2200);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md animate-fade-in p-4 select-none">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center space-y-6 relative overflow-hidden">
        {/* Top Progress Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600 animate-shimmer-light" />

        {/* Central Logo Badge */}
        <div className="py-2">
          <img
            src="/logo.png"
            alt="codeaxys logo"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Title & Active Step Status */}
        <div className="space-y-1.5">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">
            Crafting Your Website
          </h3>
          <p className="text-sm text-purple-700 font-medium h-6 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            <span>{steps[currentStepIndex].label}</span>
          </p>
        </div>

        {/* Step Progress List */}
        <div className="w-full space-y-2.5 pt-1">
          {steps.map((step, idx) => {
            const isDone = idx < currentStepIndex || stage === "complete";
            const isCurrent = idx === currentStepIndex && stage !== "complete";

            return (
              <div
                key={idx}
                className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs transition-all duration-300 ${
                  isDone
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-medium"
                    : isCurrent
                    ? "bg-purple-50 border-purple-200 text-purple-900 font-medium shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-400"
                }`}
              >
                <div className="flex items-center gap-3">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-purple-600 animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                  )}
                  <span>{step.label}</span>
                </div>

                <span className="text-[10px] font-mono opacity-70">
                  {isDone ? "Done" : isCurrent ? "Active" : "Pending"}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-500">
          Codexys AI Engine • Generates bespoke HTML, CSS & JS
        </p>
      </div>
    </div>
  );
}
