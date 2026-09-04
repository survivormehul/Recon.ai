"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  TrendingDown, 
  ExternalLink, 
  ArrowRight,
  RefreshCw,
  Clock,
  CheckCircle2,
  FileCheck2
} from "lucide-react";

function ExceptionsContent() {
  const searchParams = useSearchParams();
  const initialRunId = searchParams.get("runId") || "";

  const [exceptions, setExceptions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const fetchExceptions = async (sev: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (initialRunId) params.set("runId", initialRunId);
      if (sev !== "ALL") params.set("severity", sev);

      const res = await fetch(`/api/exceptions?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setExceptions(data.exceptions || []);
        setStats(data.stats || {});
      }
    } catch (err) {
      console.error("Failed to load exceptions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptions(selectedSeverity);
  }, [selectedSeverity, initialRunId]);

  const handleMarkResolved = (id: string) => {
    setResolvedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "HIGH":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "MEDIUM":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "LOW":
        return "bg-slate-800 text-slate-300 border-slate-700";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <AlertTriangle className="h-4 w-4" />
          Honest Financial Exception Queue
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Exception Center
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Prioritized operational exceptions graded by monetary exposure and financial risk. No cherry-picked numbers or synthetic suppression of genuine breaks.
        </p>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <span className="text-xs font-medium text-slate-400 block mb-1">Total Open Exceptions</span>
          <div className="text-2xl font-bold text-white">
            {stats.openCount !== undefined ? stats.openCount : exceptions.length}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Active human & AI queues</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <span className="text-xs font-medium text-slate-400 block mb-1">Critical & High Risk</span>
          <div className="text-2xl font-bold text-rose-400">
            {(stats.criticalCount || 0) + (stats.highCount || 0)}
          </div>
          <span className="text-[11px] text-rose-500/80 mt-1 block">Requires immediate controller action</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <span className="text-xs font-medium text-slate-400 block mb-1">Monetary Exposure</span>
          <div className="text-2xl font-bold text-amber-400">
            {stats.totalMonetaryImpactFormatted || "₹0.00"}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Sum of unresolved variance</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <span className="text-xs font-medium text-slate-400 block mb-1">Resolved Today</span>
          <div className="text-2xl font-bold text-emerald-400">
            {(stats.resolvedCount || 0) + resolvedIds.size}
          </div>
          <span className="text-[11px] text-emerald-500/80 mt-1 block">Through AI proof & ledger offsets</span>
        </div>
      </div>

      {/* Severity Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
        {[
          { id: "ALL", label: "All Severities" },
          { id: "CRITICAL", label: "Critical" },
          { id: "HIGH", label: "High" },
          { id: "MEDIUM", label: "Medium" },
          { id: "LOW", label: "Low" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedSeverity(tab.id)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              selectedSeverity === tab.id
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Exceptions List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 rounded-xl bg-slate-900 border border-slate-800">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-400" />
            Loading honest exception queue...
          </div>
        ) : exceptions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 rounded-xl bg-slate-900 border border-slate-800">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            No exceptions found for this severity filter.
          </div>
        ) : (
          exceptions.map((exc) => {
            const isResolved = resolvedIds.has(exc.id) || exc.resolved;

            return (
              <div
                key={exc.id}
                className={`p-4 rounded-xl border transition-all ${
                  isResolved
                    ? "bg-slate-950/40 border-slate-800/60 opacity-60"
                    : "bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-sm"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getSeverityBadge(exc.severity)}`}>
                        {exc.severity}
                      </span>
                      <span className="text-xs font-semibold text-white font-mono">{exc.orderId}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {exc.exceptionType}
                      </span>
                      {isResolved && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          RESOLVED
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-white">{exc.title}</h3>
                    <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">{exc.description}</p>
                  </div>

                  <div className="flex md:flex-col items-end justify-between md:justify-center shrink-0 text-right space-y-1">
                    <div className="text-base font-mono font-bold text-amber-400">
                      {exc.monetaryImpactFormatted || "₹0.00"}
                    </div>
                    <span className="text-[10px] text-slate-500 block">Monetary Impact</span>

                    {!isResolved && (
                      <button
                        type="button"
                        onClick={() => handleMarkResolved(exc.id)}
                        className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-emerald-600/30 hover:text-emerald-300 hover:border-emerald-500/40 border border-slate-700 text-xs font-medium text-slate-300 rounded-lg transition-all"
                      >
                        <FileCheck2 className="h-3.5 w-3.5" />
                        Acknowledge / Resolve
                      </button>
                    )}
                  </div>
                </div>

                {/* Recommended Action Ribbon */}
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="text-slate-400 flex items-center gap-1.5">
                    <span className="text-indigo-400 font-semibold">Recommended Action:</span>
                    <span className="text-slate-300 font-mono">{exc.recommendedAction}</span>
                  </div>
                  <span className="text-[11px] text-slate-500">Run: {exc.runId || "Current"}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function ExceptionsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-500 rounded-xl bg-slate-900 border border-slate-800">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-400" />
          Loading exception center...
        </div>
      }
    >
      <ExceptionsContent />
    </Suspense>
  );
}
