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
  Layers
} from "lucide-react";

export default function DashboardPage() {
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
          <div className="text-2xl font-bold text-white tracking-tight">0</div>
          <p className="text-xs text-slate-500 mt-1">Ready for 500+ record batch</p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
            <span>Match Rate (Deterministic)</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">--%</div>
          <p className="text-xs text-slate-500 mt-1">Measured objectively post-run</p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
            <span>Open Exceptions</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 tracking-tight">0</div>
          <p className="text-xs text-slate-500 mt-1">Categorized by severity</p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
            <span>Financial Leakage</span>
            <TrendingDown className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 tracking-tight">₹0.00</div>
          <p className="text-xs text-slate-500 mt-1">Unexplained & uncollected variance</p>
        </div>
      </div>

      {/* System Architecture Status Card */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-6">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
          Core Controller Architecture
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold">
              <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
              Deterministic Engine
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Executes high-confidence exact matches, reference normalization, fee/tax tolerances, and batched bank payout aggregations.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold">
              <div className="h-2 w-2 rounded-full bg-cyan-500"></div>
              AI Investigation Layer
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Investigates ambiguous cases using bounded tool calls. Evaluates refunds, fees, and chargebacks. Never guesses unsupported variance.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
              <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
              Segregated Evaluation
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Compares outcomes against independent ground truth. Reports true precision, recall, resolution rate, and honest exception counts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
