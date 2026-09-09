"use client";

import React from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface SaveStatusProps {
  state: SaveState;
}

export function SaveStatus({ state }: SaveStatusProps) {
  if (state === "idle") return null;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 border border-slate-200">
      {state === "saving" && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
          <span className="text-slate-600">Saving changes...</span>
        </>
      )}
      {state === "saved" && (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-emerald-700 font-semibold">Saved</span>
        </>
      )}
      {state === "error" && (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
          <span className="text-red-700">Save failed</span>
        </>
      )}
    </div>
  );
}
