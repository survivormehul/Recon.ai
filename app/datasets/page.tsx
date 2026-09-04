"use client";

import { useState } from "react";
import { 
  Database, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  Layers, 
  ShieldCheck, 
  ArrowRight,
  TrendingUp,
  FileText
} from "lucide-react";
import { Money } from "@/lib/money";

export default function DatasetsPage() {
  const [seed, setSeed] = useState(2026);
  const [recordCount, setRecordCount] = useState(500);
  const [loading, setLoading] = useState(false);
  const [datasetData, setDatasetData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"gateway" | "bank" | "distribution">("distribution");

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/datasets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed, recordCount }),
      });
      const data = await res.json();
      if (data.success) {
        setDatasetData(data.dataset);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Database className="h-6 w-6 text-indigo-400" />
            Data Sources & Synthetic Generator
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Seedable multi-source financial benchmark generator with segregated ground truth.
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
            <span className="text-slate-400">Batch Size:</span>
            <select
              value={recordCount}
              onChange={(e) => setRecordCount(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-white"
            >
              <option value={50}>50 (Fast check)</option>
              <option value={500}>500 (Default demo)</option>
              <option value={1000}>1,000 (Stress test)</option>
              <option value={2500}>2,500 (High volume)</option>
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Batch
          </button>
        </div>
      </div>

      {/* Ground Truth Isolation Notice */}
      <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/50 flex items-start gap-3.5">
        <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-semibold text-indigo-300">Strict Ground Truth Segregation Principle</span>
          <p className="text-slate-400 leading-relaxed">
            The generated dataset contains an independent ground-truth layer defining the true outcome for each scenario.
            This layer is strictly segregated from the reconciliation engine and AI investigator during runtime. It is accessed
            only post-run by the evaluation harness to calculate objective precision, recall, and exception accuracy.
          </p>
        </div>
      </div>

      {/* Generated Dataset Summary */}
      {datasetData ? (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Gateway Transactions</span>
              <div className="text-xl font-bold text-white mt-1">{datasetData.counts.gateway.toLocaleString()}</div>
              <span className="text-[11px] text-slate-500">Gross: {datasetData.financials.totalGross}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Bank Statement Credits</span>
              <div className="text-xl font-bold text-white mt-1">{datasetData.counts.bank.toLocaleString()}</div>
              <span className="text-[11px] text-slate-500">Net Expected: {datasetData.financials.totalNet}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Ledger Journal Entries</span>
              <div className="text-xl font-bold text-white mt-1">{datasetData.counts.ledger.toLocaleString()}</div>
              <span className="text-[11px] text-slate-500">Internal clearing accounts</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400">Supporting Events</span>
              <div className="text-xl font-bold text-cyan-400 mt-1">{datasetData.counts.supportingEvents.toLocaleString()}</div>
              <span className="text-[11px] text-slate-500">Refunds, Fees & Chargebacks</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 gap-6 text-sm">
            <button
              onClick={() => setActiveTab("distribution")}
              className={`pb-3 font-medium transition-colors border-b-2 ${
                activeTab === "distribution"
                  ? "border-cyan-400 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Scenario Distribution ({Object.keys(datasetData.scenarioDistribution).length} Scenarios)
            </button>
            <button
              onClick={() => setActiveTab("gateway")}
              className={`pb-3 font-medium transition-colors border-b-2 ${
                activeTab === "gateway"
                  ? "border-cyan-400 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Gateway Records Preview
            </button>
            <button
              onClick={() => setActiveTab("bank")}
              className={`pb-3 font-medium transition-colors border-b-2 ${
                activeTab === "bank"
                  ? "border-cyan-400 text-cyan-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Bank Records Preview
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "distribution" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(datasetData.scenarioDistribution).map(([cat, count]: any) => (
                <div key={cat} className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{cat.replace(/_/g, " ")}</div>
                    <div className="text-[11px] text-slate-500">
                      {((count / datasetData.counts.gateway) * 100).toFixed(1)}% of batch
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "gateway" && (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Gross Amount</th>
                    <th className="p-3">Fee + GST</th>
                    <th className="p-3">Net Settlement</th>
                    <th className="p-3">Reference / UTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {datasetData.preview.gateway.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-mono font-medium text-white">{r.orderId}</td>
                      <td className="p-3 text-slate-300">{r.paymentMethod}</td>
                      <td className="p-3 font-mono text-white">{r.formattedGross}</td>
                      <td className="p-3 font-mono text-slate-400">
                        {Money.format(BigInt(r.feeMinorUnits) + BigInt(r.taxMinorUnits))}
                      </td>
                      <td className="p-3 font-mono text-emerald-400 font-medium">{r.formattedNet}</td>
                      <td className="p-3 font-mono text-slate-400">{r.rawReference || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "bank" && (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">UTR Reference</th>
                    <th className="p-3">Credit Amount</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Booking Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {datasetData.preview.bank.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-mono font-medium text-white">{r.utrReference}</td>
                      <td className="p-3 font-mono text-emerald-400 font-medium">{r.formattedCredit}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          r.isBatched ? "bg-purple-950 text-purple-300 border border-purple-800" : "bg-slate-800 text-slate-300"
                        }`}>
                          {r.isBatched ? `Batched (${r.batchCount})` : "Direct"}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-400 truncate max-w-xs">{r.rawDescription}</td>
                      <td className="p-3 text-slate-400">{new Date(r.bookingDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="p-12 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center">
          <Layers className="h-10 w-10 text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No Dataset Generated Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Click &ldquo;Generate Batch&rdquo; above to generate a 500+ record deterministic financial dataset with all 18 test scenarios and isolated ground truth.
          </p>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all"
          >
            <Sparkles className="h-4 w-4" />
            Generate 500 Records (Seed 2026)
          </button>
        </div>
      )}
    </div>
  );
}
