"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  CheckCircle2, 
  Circle, 
  PlayCircle, 
  ArrowLeftRight, 
  AlertTriangle, 
  TrendingDown, 
  ShieldCheck, 
  History, 
  MessageSquareCode, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight,
  Sparkles
} from "lucide-react";

interface GuidedStepsProps {
  hasCompletedRun: boolean;
  activeRunId?: string | null;
  onTriggerRun?: () => void;
}

interface StepItem {
  id: number;
  title: string;
  shortDesc: string;
  what: string;
  why: string;
  lookFor: string;
  href?: string;
  isAction?: boolean;
  icon: React.ElementType;
}

export function GuidedSteps({
  hasCompletedRun,
  activeRunId,
  onTriggerRun,
}: GuidedStepsProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [selectedStep, setSelectedStep] = useState<number>(hasCompletedRun ? 2 : 1);

  const steps: StepItem[] = [
    {
      id: 1,
      title: "Run Reconciliation",
      shortDesc: "Trigger 3-way multi-source matching",
      what: "Executes deterministic matching across Gateway, Bank settlement, and Ledger records, then dispatches bounded AI investigation for ambiguous cases.",
      why: "Finance controllers cannot manually reconcile thousands of records with varying UTR notations, gateway fees, and timing differences.",
      lookFor: "Notice how deterministic rules handle the high-volume 1-to-1 matches instantly, while AI only handles complex edge cases.",
      isAction: true,
      icon: PlayCircle,
    },
    {
      id: 2,
      title: "Review Matches",
      shortDesc: "Side-by-side evidence ledger",
      what: "Presents Gateway, Bank, and Ledger transaction data side-by-side with exact paise amounts, fees, taxes, and UTR references.",
      why: "Accounting books require complete traceability for every credited rupee before marking an invoice paid.",
      lookFor: "Filter by MATCHED or RESOLVED to verify that variance is 0.00 or mathematically accounted for.",
      href: activeRunId ? `/transactions?runId=${activeRunId}` : "/transactions",
      icon: ArrowLeftRight,
    },
    {
      id: 3,
      title: "Investigate Exceptions",
      shortDesc: "Honest escalations & reasoning",
      what: "Surfaces the honest exception queue containing transactions where evidence was missing, conflicting, or inconclusive.",
      why: "Autonomous systems must never guess on financial ledgers. When proof is lacking, honest escalation is the safe choice.",
      lookFor: "Check the AI explanation and monetary severity tag (CRITICAL, HIGH, MEDIUM) to see why auto-resolution was withheld.",
      href: activeRunId ? `/exceptions?runId=${activeRunId}` : "/exceptions",
      icon: AlertTriangle,
    },
    {
      id: 4,
      title: "Check Financial Leakage",
      shortDesc: "Variance & recovery recovery claims",
      what: "Analyzes financial variances into Detected, Prevented, and Recoverable leakage across MDR overcharges and timing mismatches.",
      why: "Unreconciled variances represent direct bottom-line revenue loss for merchants and platforms.",
      lookFor: "Review the leakage breakdown table and test filing a one-click recovery dispute claim for bank settlement delays.",
      href: activeRunId ? `/leakage?runId=${activeRunId}` : "/leakage",
      icon: TrendingDown,
    },
    {
      id: 5,
      title: "Verify Objective Evaluation",
      shortDesc: "Segregated ground-truth scoring",
      what: "Compares the reconciliation run against isolated, unvarnished ground truth to compute Precision, Recall, F1, and the Confusion Matrix.",
      why: "Confirms that metrics are not cherry-picked or hallucinated. The evaluation engine is completely isolated from the matcher.",
      lookFor: "Verify that Precision is near 100% (zero false matches) and examine the True Positives vs False Negatives breakdown.",
      href: activeRunId ? `/evaluation?runId=${activeRunId}` : "/evaluation",
      icon: ShieldCheck,
    },
    {
      id: 6,
      title: "Inspect Audit Trail",
      shortDesc: "Immutable operations history",
      what: "Displays the append-only chronological log of every match decision, tool call, threshold change, and resolution event.",
      why: "Statutory audits and internal controllers require non-repudiation and complete decision provenance.",
      lookFor: "Expand an event to inspect its cryptographic SHA-256 payload and verify who made the decision (Engine vs AI vs Controller).",
      href: activeRunId ? `/audit?runId=${activeRunId}` : "/audit",
      icon: History,
    },
    {
      id: 7,
      title: "Ask the Controller",
      shortDesc: "Grounded conversational assistant",
      what: "A natural language FinOps assistant backed by live database queries and strict anti-hallucination citation checks.",
      why: "CFOs and controllers need instant plain-English summaries without having to write SQL queries or export CSVs.",
      lookFor: "Ask 'What is our total unexplained variance?' and notice how every figure cites verified order IDs and run metrics.",
      href: activeRunId ? `/ask?runId=${activeRunId}` : "/ask",
      icon: MessageSquareCode,
    },
  ];

  const currentStepData = steps.find((s) => s.id === selectedStep) || steps[0];

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
      {/* Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 sm:px-6 cursor-pointer flex items-center justify-between hover:bg-slate-800/40 transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                FinOps Controller Operational Checklist
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                {hasCompletedRun ? "Active Batch Ready" : "Start Here"}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive 7-phase operational loop: from multi-source batch ingestion to grounded FinOps intelligence.
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label={isExpanded ? "Collapse Checklist" : "Expand Checklist"}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700"
        >
          <span>{isExpanded ? "Minimize" : "Open Checklist"}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-6 border-t border-slate-800 space-y-6">
          {/* Step Selector Horizontal Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {steps.map((step) => {
              const isSelected = selectedStep === step.id;
              const isCompleted = step.id === 1 ? hasCompletedRun : hasCompletedRun;
              const Icon = step.icon;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setSelectedStep(step.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all relative ${
                    isSelected
                      ? "bg-slate-950 border-cyan-500/80 shadow-md shadow-cyan-950/40"
                      : "bg-slate-950/50 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-400 font-mono">
                      0{step.id}
                    </span>
                    {step.id === 1 && hasCompletedRun ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : isSelected ? (
                      <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                    ) : (
                      <Circle className="h-3 w-3 text-slate-600" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-white truncate">
                    {step.title}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {step.shortDesc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detailed Inspector Card for the Selected Step */}
          <div className="rounded-xl bg-slate-950/80 border border-slate-800/80 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-cyan-400">
                  <currentStepData.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-cyan-400 font-mono">
                      STAGE 0{currentStepData.id}
                    </span>
                    <h4 className="text-base font-bold text-white">
                      {currentStepData.title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-400">{currentStepData.shortDesc}</p>
                </div>
              </div>

              <div>
                {currentStepData.isAction ? (
                  <button
                    type="button"
                    onClick={onTriggerRun}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Go to Run Console
                  </button>
                ) : (
                  <Link
                    href={currentStepData.href || "#"}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white text-xs font-semibold border border-slate-700 transition-all"
                  >
                    <span>Open {currentStepData.title}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>

            {/* WHAT / WHY / LOOK FOR Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  What this section does
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentStepData.what}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Why it matters
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentStepData.why}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  What to look for
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentStepData.lookFor}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
