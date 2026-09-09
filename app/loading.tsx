import { RefreshCw } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900 font-sans">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shadow-sm">
          <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-slate-800">Loading Codexys AI Platform...</h3>
          <p className="text-xs text-slate-400 mt-1">Preparing your workspace</p>
        </div>
      </div>
    </div>
  );
}
