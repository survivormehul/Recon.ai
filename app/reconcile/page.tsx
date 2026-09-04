"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  PlayCircle, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  Clock, 
  Zap, 
  Layers, 
  RefreshCw,
  Sliders,
  TrendingDown
} from "lucide-react";

export default function ReconcilePage() {
  const [recordCount, setRecordCount] = useState<number>(500);
  const [seed, setSeed] = useState<number>(2026);
  const [useAi, setUseAi] = useState<boolean>(true);
  const [aiProvider, setAiProvider] = useState<string>("gemini");
  
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentStage, setCurrentStage] = useState<number>(0); // 0: Idle, 1: Det, 2: AI, 3: Eval, 4: Done
  const [runResult, setRunResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLaunch = async () => {
    setIsRunning(true);
    setErrorMessage(null);
    setRunResult(null);
    setCurrentStage(1);

    try {
      // Simulate visual progression through stages
      const stageTimer1 = setTimeout(() => setCurrentStage(2), 600);
      const stageTimer2 = setTimeout(() => setCurrentStage(3), 1400);

      const response = await fetch("/api/reconciliation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordCount,
          seed,
          useAi,
          aiProvider,
        }),
      });

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to complete reconciliation run");
      }

      setRunResult(data);
      setCurrentStage(4);
    } catch (err: any) {
      console.error("Run error:", err);
      setErrorMessage(err.message || "An unexpected error occurred during execution");
      setCurrentStage(0);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <Cpu className="h-4 w-4" />
          Autonomous Loop Orchestrator
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Execute Reconciliation Run
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Trigger the 3-stage reconciliation pipeline: multi-source deterministic matching, bounded AI exception investigation with real-time tool calling, and segregated ground-truth evaluation.
        </p>
      </div>

      {/* Control Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Run Configuration Form */}
        <div className="lg:col-span-1 rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-400" />
              Batch Configuration
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Ready
            </span>
          </div>

          {/* Dataset Size Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">
              Dataset Size (Multi-Source Batch)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[50, 100, 500].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setRecordCount(count)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                    recordCount === count
                      ? "bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-sm"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  {count} records
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                    {count === 500 ? "Full Track" : count === 100 ? "Standard" : "Quick"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Deterministic Seed */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Deterministic Seed</span>
              <span className="text-[11px] text-slate-400">Replicable ground truth</span>
            </label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* AI Investigation Toggle */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">AI Investigation Layer</span>
                <span className="text-[11px] text-slate-400 block">Bounded tools & anti-hallucination checks</span>
              </div>
              <input
                type="checkbox"
                checked={useAi}
                onChange={(e) => setUseAi(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900 cursor-pointer"
              />
            </div>

            {useAi && (
              <div className="pt-2 border-t border-slate-800/60 space-y-2">
                <label className="text-[11px] font-medium text-slate-400">
                  AI Provider & Model
                </label>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="gemini">Google Gemini 3.6 Flash (Live / Configured)</option>
                  <option value="offline_fallback">Offline Deterministic Reasoner (Air-Gapped)</option>
                </select>
              </div>
            )}
          </div>

          {/* Launch Button */}
          <button
            type="button"
            onClick={handleLaunch}
            disabled={isRunning}
            className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
              isRunning
                ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white shadow-indigo-500/25"
            }`}
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Executing Reconciliation...
              </>
            ) : (
              <>
                <PlayCircle className="h-5 w-5" />
                Launch Reconciliation Loop
              </>
            )}
          </button>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Pipeline Execution Tracker */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-6 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2 pb-3 border-b border-slate-800">
              <Zap className="h-4 w-4 text-cyan-400" />
              Reconciliation Pipeline Status
            </h2>

            {/* Stage Progress Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Stage 1 */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  currentStage >= 1
                    ? "bg-slate-950 border-indigo-500/50 shadow-sm"
                    : "bg-slate-950/40 border-slate-800 text-slate-500"
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-300">Stage 1</span>
                  {currentStage > 1 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : currentStage === 1 ? (
                    <RefreshCw className="h-4 w-4 text-indigo-400 animate-spin" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-slate-700" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-white">Deterministic Matcher</h3>
                <p className="text-xs text-slate-400 mt-1">
                  1-to-1 exact, UTR/RRN normalization, fee & GST tolerance, batch payouts.
                </p>
              </div>

              {/* Stage 2 */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  currentStage >= 2
                    ? "bg-slate-950 border-cyan-500/50 shadow-sm"
                    : "bg-slate-950/40 border-slate-800 text-slate-500"
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-300">Stage 2</span>
                  {currentStage > 2 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : currentStage === 2 ? (
                    <RefreshCw className="h-4 w-4 text-cyan-400 animate-spin" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-slate-700" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-white">Bounded AI Investigation</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Autonomous tool calls over supporting events, refunds, disputes, rate revisions.
                </p>
              </div>

              {/* Stage 3 */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  currentStage >= 3
                    ? "bg-slate-950 border-emerald-500/50 shadow-sm"
                    : "bg-slate-950/40 border-slate-800 text-slate-500"
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-300">Stage 3</span>
                  {currentStage >= 4 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : currentStage === 3 ? (
                    <RefreshCw className="h-4 w-4 text-emerald-400 animate-spin" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-slate-700" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-white">Ground-Truth Evaluation</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Objective grading against isolated truth, honest exceptions, financial leakage.
                </p>
              </div>
            </div>

            {/* Real-Time Run Result Banner */}
            {runResult && (
              <div className="rounded-xl bg-gradient-to-r from-emerald-950/30 via-slate-950 to-slate-950 border border-emerald-500/30 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-bold text-emerald-400">
                      Reconciliation Run Completed Successfully
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {runResult.runId}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {runResult.durationMs}ms
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 text-cyan-400" />
                      {runResult.metrics.throughputPerSecond} rec/sec
                    </span>
                  </div>
                </div>

                {/* KPI Grid for This Run */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[11px] font-medium text-slate-400">Match Rate</span>
                    <div className="text-xl font-bold text-emerald-400">
                      {runResult.metrics.matchRatePercent}%
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {runResult.metrics.matchedCount} / {runResult.metrics.totalRecords} records
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[11px] font-medium text-slate-400">AI Resolved</span>
                    <div className="text-xl font-bold text-cyan-400">
                      {runResult.metrics.resolvedCount}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {runResult.metrics.aiInvestigationsCount} investigated
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[11px] font-medium text-slate-400">Open Exceptions</span>
                    <div className="text-xl font-bold text-amber-400">
                      {runResult.metrics.exceptionCount}
                    </div>
                    <span className="text-[10px] text-slate-500">Honest & prioritized</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[11px] font-medium text-slate-400">Financial Leakage</span>
                    <div className="text-xl font-bold text-rose-400">
                      {runResult.financials.formattedLeakage}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Prevented: {runResult.financials.formattedPrevented}
                    </span>
                  </div>
                </div>

                {/* Quick Navigation Links */}
                <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/transactions?runId=${runResult.runId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                  >
                    View All Transactions
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>

                  <Link
                    href={`/exceptions?runId=${runResult.runId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-medium border border-slate-700 transition-colors"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Inspect Exceptions ({runResult.metrics.exceptionCount})
                  </Link>

                  <Link
                    href={`/evaluation?runId=${runResult.runId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-medium border border-slate-700 transition-colors"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    View Ground Truth Evaluation
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="text-xs text-slate-400 flex items-center justify-between border-t border-slate-800 pt-4">
            <span>Recon.ai v1.0 • Multi-Source Payment Reconciliation Engine</span>
            <span>Razorpay AI Buildathon 2026 • Track 04</span>
          </div>
        </div>
      </div>
    </div>
  );
}
