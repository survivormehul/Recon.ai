"use client";

import { Activity, Shield, Database, Sparkles } from "lucide-react";

export function Navbar() {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0B0F17]/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-white">Autonomous Finance Operations Console</h1>
        <span className="text-xs text-slate-500 font-mono">Razorpay Buildathon Track 04</span>
      </div>

      <div className="flex items-center gap-4">
        {/* System Badges */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-3 py-1 text-xs">
          <Database className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-slate-400">PostgreSQL 16</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-3 py-1 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-slate-400">AI Layer:</span>
          <span className="text-cyan-300 font-medium">Gemini / Offline Mode</span>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full px-3 py-1 text-xs">
          <Shield className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-slate-400">Ground Truth:</span>
          <span className="text-indigo-300 font-medium">Segregated</span>
        </div>
      </div>
    </header>
  );
}
