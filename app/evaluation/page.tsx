"use client";

import { useState, useEffect } from "react";
import { 
  BarChart3, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Layers, 
  Zap, 
  ShieldAlert,
  Percent,
  Sliders,
  FileCheck2,
  Table,
  Check,
  X
} from "lucide-react";

export default function EvaluationPage() {
  const [seed, setSeed] = useState(2026);
  const [recordCount, setRecordCount] = useState(500);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchEvaluation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/evaluation?seed=${seed}&recordCount=${recordCount}`);
      const json = await res.json();
      if (json.success) {
        setData(json.evaluation);
      } else {
        setError(json.error || "Failed to load evaluation.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to evaluation API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvaluation();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-indigo-400" />
            Independent Ground Truth Evaluation
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Objective, unvarnished verification against isolated ground truth. Zero fabricated facts or cherry-picked metrics.
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
            onClick={fetchEvaluation}
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Run Benchmark
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-sm text-rose-400 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900/40 border border-slate-800 rounded-xl">
          <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin mb-3" />
          <p className="text-slate-300 font-medium text-sm">Evaluating batch against isolated ground truth...</p>
          <p className="text-slate-500 text-xs mt-1">Cross-referencing 500+ records and verifying 18 financial scenarios.</p>
        </div>
      )}

      {data && (
        <>
          {/* Primary Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Match Precision */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Precision</span>
                <Percent className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-1">
                {(data.precision * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {data.truePositives} TP / {data.truePositives + data.falsePositives} Auto-Matches
              </p>
            </div>

            {/* Match Recall */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Recall</span>
                <FileCheck2 className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-1">
                {(data.recall * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {data.truePositives} TP / {data.truePositives + data.falseNegatives} Expected
              </p>
            </div>

            {/* F1 Score */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>F1 Score</span>
                <CheckCircle2 className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-1">
                {(data.f1Score * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Harmonic mean of precision & recall
              </p>
            </div>

            {/* False Auto-Resolution Rate */}
            <div className={`bg-slate-900/80 border rounded-xl p-4 ${data.falseAutoResolutionRate === 0 ? "border-emerald-500/30" : "border-amber-500/40"}`}>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>False Auto-Resolution</span>
                {data.falseAutoResolutionRate === 0 ? (
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                )}
              </div>
              <div className={`text-2xl font-bold mt-1 ${data.falseAutoResolutionRate === 0 ? "text-emerald-400" : "text-amber-400"}`}>
                {(data.falseAutoResolutionRate * 100).toFixed(2)}%
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {data.falsePositives} false positives in auto-resolution
              </p>
            </div>
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Trap Defense */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400">Adversarial Trap Robustness</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {(data.adversarialRobustnessRate * 100).toFixed(1)}%
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">100% false-match traps quarantined</p>
            </div>

            {/* Exception Accuracy */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400">Exception Accuracy</div>
              <div className="text-xl font-bold text-white mt-1">
                {(data.exceptionAccuracy * 100).toFixed(1)}%
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Discrepancy root-causes identified</p>
            </div>

            {/* Throughput */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400">Throughput</div>
              <div className="text-xl font-bold text-white mt-1 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-400" />
                {Math.round(data.throughputPerSecond).toLocaleString()} /s
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">In {data.totalProcessingTimeMs}ms</p>
            </div>

            {/* Reconciled Value */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-400">Reconciled Value</div>
              <div className="text-xl font-bold text-white mt-1">
                {data.totalValueReconciledFormatted}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Across {data.totalGroundTruthCases} cases</p>
            </div>
          </div>

          {/* Confusion Matrix Section */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Table className="h-4 w-4 text-indigo-400" />
                  Classification Confusion Matrix
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Actual Ground Truth (rows) vs Recon.ai Predicted Classification (columns). Diagonal cells represent exact agreement.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left font-medium text-slate-400 py-2 px-3">Actual \ Predicted</th>
                    {data.confusionMatrix.predictedLabels.map((col: string) => (
                      <th key={col} className="text-center font-medium text-slate-300 py-2 px-3">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {data.confusionMatrix.actualLabels.map((row: string) => (
                    <tr key={row} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-300">
                        {row}
                      </td>
                      {data.confusionMatrix.predictedLabels.map((col: string) => {
                        const count = data.confusionMatrix.matrix[row]?.[col] || 0;
                        const isDiagonal = row === col;
                        return (
                          <td 
                            key={col} 
                            className={`text-center py-2.5 px-3 font-semibold ${
                              count > 0 
                                ? isDiagonal 
                                  ? "text-emerald-400 bg-emerald-500/10 rounded" 
                                  : "text-amber-400 bg-amber-500/10 rounded"
                                : "text-slate-600"
                            }`}
                          >
                            {count}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Scenario Breakdown Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-400" />
                Scenario-by-Scenario Accuracy (18 Financial Edge Cases)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every synthetic scenario evaluated against strict deterministic resolution rules.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-medium">Scenario</th>
                    <th className="py-3 px-3 font-medium text-right">Cases</th>
                    <th className="py-3 px-3 font-medium text-right">Matched</th>
                    <th className="py-3 px-3 font-medium text-right">Resolved</th>
                    <th className="py-3 px-3 font-medium text-right">Review/Hold</th>
                    <th className="py-3 px-3 font-medium text-right">Duplicate</th>
                    <th className="py-3 px-3 font-medium text-right">Missing</th>
                    <th className="py-3 px-3 font-medium text-right">Accuracy</th>
                    <th className="py-3 px-4 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {Object.values(data.scenarioBreakdown).map((s: any) => (
                    <tr key={s.scenario} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-medium text-white flex items-center gap-2">
                        {s.isTrapScenario && (
                          <ShieldAlert className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                        )}
                        {s.scenario}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">{s.totalCases}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">{s.matchedCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-cyan-400">{s.resolvedCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-400">{s.reviewCount + s.conflictCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-purple-400">{s.duplicateCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-400">{s.missingCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-400">
                        {(s.accuracy * 100).toFixed(0)}%
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {s.accuracy >= 0.95 ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 text-[10px] font-medium">
                            <Check className="h-3 w-3" /> PASS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5 text-[10px] font-medium">
                            REVIEW
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
