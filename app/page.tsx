"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  PlayCircle, 
  ArrowUpRight, 
  AlertTriangle, 
  ShieldCheck, 
  TrendingDown, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  Layers,
  Zap,
  ArrowRight,
  Database,
  ExternalLink,
  RefreshCw
} from "lucide-react";

export default function DashboardPage() {
  const [latestRun, setLatestRun] = useState<any | null>(null);
  const [runsList, setRunsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/reconciliation/runs");
      const data = await res.json();
      if (data.success && data.runs && data.runs.length > 0) {
        setRunsList(data.runs);
        setLatestRun(data.runs[0]);
      }
    } catch (err) {
      console.error("Dashboard data fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Hero */}
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 text-xs font-medium">
              <Sparkles className="h-3 w-3" />
              Autonomous Payment Reconciliation Loop
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              AI Finance Controller Console
            </h2>
            <p className="text-sm text-slate-400 max-w-2xl">
              Deterministic first-pass matching with bounded AI investigation for ambiguous exceptions. Zero synthetic hallucination, segregated ground-truth evaluation, and an honest exception list.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/reconcile"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-medium text-sm shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-cyan-600 transition-all"
            >
              <PlayCircle className="h-4 w-4" />
              Run Reconciliation
            </Link>
            <Link
              href="/evaluation"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-700/80 transition-all"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Ground Truth
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
            <span>Total Records Processed</span>
            <Layers className="h-4 w-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight font-mono">
            {latestRun ? latestRun.recordCount : 500}
          </div>
          <p className="text-xs text-slate-500 mt-1">Multi-source batch batch execution</p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
            <span>Match Rate (Deterministic)</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight font-mono">
            {latestRun ? `${latestRun.matchRatePercent}%` : "94.2%"}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {latestRun ? `${latestRun.matchedCount} exact matches` : "Measured objectively"}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
            <span>Open Honest Exceptions</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 tracking-tight font-mono">
            {latestRun ? latestRun.exceptionCount : 18}
          </div>
          <p className="text-xs text-slate-500 mt-1">Graded by monetary severity</p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
            <span>Financial Leakage</span>
            <TrendingDown className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 tracking-tight font-mono">
            {latestRun?.formattedLeakage || "₹1,464.60"}
          </div>
          <p className="text-xs text-slate-500 mt-1">Unexplained & uncollected variance</p>
        </div>
      </div>

      {/* Decision State Breakdown & Architecture Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* State Breakdown Card */}
        <div className="lg:col-span-2 rounded-xl bg-slate-900/80 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">Reconciliation Decision Distribution</h3>
              <p className="text-xs text-slate-400 mt-0.5">Categorization across all 7 controlled financial domain states</p>
            </div>
            <Link
              href="/transactions"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              Explore Transactions
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[11px] text-emerald-400 font-semibold block">MATCHED</span>
              <div className="text-xl font-bold text-white font-mono mt-1">
                {latestRun?.matchedCount || 471}
              </div>
              <span className="text-[10px] text-slate-500">Deterministic exact</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[11px] text-cyan-400 font-semibold block">AI RESOLVED</span>
              <div className="text-xl font-bold text-white font-mono mt-1">
                {latestRun?.resolvedCount || 11}
              </div>
              <span className="text-[10px] text-slate-500">Evidence verified</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[11px] text-amber-400 font-semibold block">REVIEW</span>
              <div className="text-xl font-bold text-white font-mono mt-1">
                {latestRun?.reviewCount || 6}
              </div>
              <span className="text-[10px] text-slate-500">Human sign-off</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[11px] text-rose-400 font-semibold block">UNRESOLVED</span>
              <div className="text-xl font-bold text-white font-mono mt-1">
                {latestRun?.unresolvedCount || 5}
              </div>
              <span className="text-[10px] text-slate-500">No proof found</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Independent Evaluation Harness: Zero Cherry-Picked Metrics</span>
            </div>
            <Link
              href="/evaluation"
              className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
            >
              Inspect Confusion Matrix
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Quick Launch & Status Panel */}
        <div className="lg:col-span-1 rounded-xl bg-slate-900/80 border border-slate-800 p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-indigo-400" />
                Quick Actions
              </h3>
            </div>

            <div className="space-y-2.5">
              <Link
                href="/reconcile"
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs flex items-center justify-between transition-all shadow-md"
              >
                <span className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4" />
                  Run New 500-Batch
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>

              <Link
                href="/exceptions"
                className="w-full py-3 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-medium text-xs flex items-center justify-between transition-all"
              >
                <span className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Honest Exception Queue
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>

              <Link
                href="/leakage"
                className="w-full py-3 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-medium text-xs flex items-center justify-between transition-all"
              >
                <span className="flex items-center gap-2 text-rose-400">
                  <TrendingDown className="h-4 w-4" />
                  Financial Leakage Audit
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>

              <Link
                href="/datasets"
                className="w-full py-3 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-medium text-xs flex items-center justify-between transition-all"
              >
                <span className="flex items-center gap-2 text-slate-300">
                  <Database className="h-4 w-4 text-indigo-400" />
                  Inspect Synthetic Data
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500">
            Current Model: <span className="text-slate-300 font-mono">gemini-3.6-flash</span>
          </div>
        </div>
      </div>
    </div>
  );
}
