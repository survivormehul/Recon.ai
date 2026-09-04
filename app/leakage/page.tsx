"use client";

import { useState, useEffect } from "react";
import { 
  TrendingDown, 
  ShieldCheck, 
  AlertCircle, 
  DollarSign, 
  RefreshCw, 
  ArrowUpRight, 
  FileText, 
  CheckCircle2, 
  HelpCircle,
  ExternalLink,
  ShieldAlert,
  Clock,
  Building,
  Check
} from "lucide-react";

export default function FinancialLeakagePage() {
  const [seed, setSeed] = useState(2026);
  const [recordCount, setRecordCount] = useState(500);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimedItems, setClaimedItems] = useState<Record<string, boolean>>({});

  const fetchLeakageData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/evaluation?seed=${seed}&recordCount=${recordCount}`);
      const json = await res.json();
      if (json.success) {
        setData(json.evaluation);
      } else {
        setError(json.error || "Failed to load leakage metrics.");
      }
    } catch (err: any) {
      setError(err.message || "Network error loading leakage metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeakageData();
  }, []);

  const handleClaim = (category: string) => {
    setClaimedItems((prev) => ({ ...prev, [category]: true }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <TrendingDown className="h-6 w-6 text-rose-400" />
            Financial Leakage & Recovery Center
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Autonomous detection, quantification, and clawback tracking for gateway overcharges, phantom credits, and missing payouts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
            <span className="text-slate-400">Seed:</span>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-white font-mono"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
            <span className="text-slate-400">Batch:</span>
            <select
              value={recordCount}
              onChange={(e) => setRecordCount(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-white"
            >
              <option value={50}>50 records</option>
              <option value={500}>500 records</option>
              <option value={1000}>1,000 records</option>
            </select>
          </div>

          <button
            onClick={fetchLeakageData}
            disabled={loading}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Audit Leakage
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-sm text-rose-400 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900/40 border border-slate-800 rounded-xl">
          <RefreshCw className="h-8 w-8 text-rose-400 animate-spin mb-3" />
          <p className="text-slate-300 font-medium text-sm">Auditing fee schedules, duplicates, and missing credits...</p>
        </div>
      )}

      {data && (
        <>
          {/* Top Level Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Detected Leakage */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Detected Leakage</span>
                <TrendingDown className="h-4 w-4 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-rose-400 mt-1">
                {data.detectedLeakageFormatted}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Total quantified variance across batch
              </p>
            </div>

            {/* Prevented Leakage */}
            <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Prevented Loss</span>
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {data.preventedLeakageFormatted}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Traps & double payouts blocked
              </p>
            </div>

            {/* Recoverable Amount */}
            <div className="bg-slate-900/80 border border-indigo-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Recoverable Claims</span>
                <DollarSign className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-indigo-400 mt-1">
                {data.recoverableFormatted}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Reclaimable from gateway/bank
              </p>
            </div>

            {/* Unexplained Variance */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Unexplained Residual</span>
                <HelpCircle className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 mt-1">
                {data.totalUnexplainedVarianceFormatted}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Remaining discrepancy for AI audit
              </p>
            </div>
          </div>

          {/* Categorized Breakdown */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">Leakage Root-Cause Breakdown</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(data.leakageBreakdown).map((item: any) => {
                const isClaimed = claimedItems[item.category];
                return (
                  <div key={item.category} className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white flex items-center gap-2">
                          {item.category.replace(/_/g, " ")}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-white font-mono">{item.monetaryFormatted}</div>
                        <div className="text-[11px] text-slate-400">{item.count} occurrences</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                      <div>
                        <span className="text-slate-500">Prevented: </span>
                        <span className="font-semibold text-emerald-400">{item.preventedFormatted}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500">Recoverable: </span>
                        <span className="font-semibold text-indigo-400">{item.recoverableFormatted}</span>
                      </div>
                    </div>

                    {item.count > 0 && item.recoverableFormatted !== "₹0.00" && (
                      <div className="pt-1">
                        <button
                          onClick={() => handleClaim(item.category)}
                          disabled={isClaimed}
                          className={`w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
                            isClaimed 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" 
                              : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                          }`}
                        >
                          {isClaimed ? (
                            <>
                              <Check className="h-3.5 w-3.5" /> Claim Packet Prepared
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="h-3.5 w-3.5 text-indigo-400" /> Prepare Gateway Claim ({item.recoverableFormatted})
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
