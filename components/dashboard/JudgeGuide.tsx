"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Award, 
  ChevronDown, 
  ChevronUp, 
  PlayCircle, 
  ArrowLeftRight, 
  AlertTriangle, 
  TrendingDown, 
  ShieldCheck, 
  History, 
  MessageSquareCode, 
  ArrowRight,
  ExternalLink,
  Sparkles
} from "lucide-react";

interface JudgeGuideProps {
  activeRunId?: string | null;
  onSelectRun500?: () => void;
}

export function JudgeGuide({ activeRunId, onSelectRun500 }: JudgeGuideProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const steps = [
    {
      num: 1,
      title: "Run 500-Record Reconciliation",
      description: "Trigger the multi-source loop with 500 records (recommended hackathon benchmark).",
      actionLabel: "Launch Run",
      icon: PlayCircle,
      badge: "Primary Action",
      onClick: onSelectRun500,
    },
    {
      num: 2,
      title: "Review 3-Way Matches",
      description: "Compare Gateway, Bank settlement, and Ledger records side-by-side with exact paise tolerances.",
      href: activeRunId ? `/transactions?runId=${activeRunId}` : "/transactions",
      actionLabel: "Explore Transactions",
      icon: ArrowLeftRight,
    },
    {
      num: 3,
      title: "Inspect Honest Exceptions",
      description: "See what Recon.ai intentionally refused to auto-match to prevent unauthorized ledger corruption.",
      href: activeRunId ? `/exceptions?runId=${activeRunId}` : "/exceptions",
      actionLabel: "View Exceptions",
      icon: AlertTriangle,
    },
    {
      num: 4,
      title: "Audit Financial Leakage",
      description: "Review detected vs prevented monetary variance and test one-click recovery claims.",
      href: activeRunId ? `/leakage?runId=${activeRunId}` : "/leakage",
      actionLabel: "Inspect Leakage",
      icon: TrendingDown,
    },
    {
      num: 5,
      title: "Verify Objective Evaluation",
      description: "Inspect Precision, Recall, F1, and the Confusion Matrix scored against isolated ground truth.",
      href: activeRunId ? `/evaluation?runId=${activeRunId}` : "/evaluation",
      actionLabel: "Inspect Ground Truth",
      icon: ShieldCheck,
    },
    {
      num: 6,
      title: "Inspect Immutable Audit Trail",
      description: "Verify cryptographic SHA-256 logs of every deterministic decision and AI tool call.",
      href: activeRunId ? `/audit?runId=${activeRunId}` : "/audit",
      actionLabel: "View Audit Log",
      icon: History,
    },
    {
      num: 7,
      title: "Ask the Controller",
      description: "Query the verified financial run using natural language and verify zero hallucinated figures.",
      href: activeRunId ? `/ask?runId=${activeRunId}` : "/ask",
      actionLabel: "Ask Controller",
      icon: MessageSquareCode,
    },
  ];

  return (
    <div className="rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-indigo-950/30 border border-indigo-500/30 shadow-xl overflow-hidden transition-all">
      {/* Header Bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 sm:px-6 cursor-pointer flex items-center justify-between hover:bg-slate-800/30 transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Award className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Hackathon Judge & Reviewer Evaluation Guide
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Recommended 7-Step Journey
              </span>
            </div>
            <p className="text-xs text-slate-400">
              New to Recon.ai? Follow this 3-minute guided walkthrough to evaluate full-loop autonomous FinOps.
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label={isExpanded ? "Collapse Guide" : "Expand Guide"}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-800/50"
        >
          <span>{isExpanded ? "Hide Guide" : "View Judge Walkthrough"}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Expandable Step-by-Step Walkthrough */}
      {isExpanded && (
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/70 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="rounded-xl bg-slate-900/90 border border-slate-800/80 p-3.5 flex flex-col justify-between hover:border-slate-700 transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800/60 text-[10px] font-bold flex items-center justify-center">
                          {step.num}
                        </span>
                        <Icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                      </div>
                      {step.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-semibold">
                          {step.badge}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-white leading-tight">
                      {step.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                      {step.description}
                    </p>
                  </div>

                  <div className="pt-3 mt-2 border-t border-slate-800/60">
                    {step.onClick ? (
                      <button
                        type="button"
                        onClick={step.onClick}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>{step.actionLabel}</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    ) : (
                      <Link
                        href={step.href || "#"}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1.5 border border-slate-700/60 transition-colors"
                      >
                        <span>{step.actionLabel}</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/60">
            <span>
              💡 <strong>Judge Tip:</strong> All financial arithmetic uses integer paise (₹1 = 100 paise) to prevent floating-point rounding errors.
            </span>
            <span className="text-indigo-400 font-medium">Track 04 • Razorpay AI Buildathon 2026</span>
          </div>
        </div>
      )}
    </div>
  );
}
