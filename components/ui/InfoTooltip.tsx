"use client";

import React, { useState, useRef, useEffect } from "react";
import { HelpCircle, Info } from "lucide-react";

export const CONCEPT_DEFINITIONS: Record<
  string,
  { title: string; explanation: string; reviewerNote?: string }
> = {
  deterministic_matching: {
    title: "Deterministic Matching",
    explanation:
      "Rule-based, mathematically reproducible financial matching decisions (exact paise amounts, UTR/RRN references, and strict fee/GST tolerances). These are mathematically verified accounting matches, not AI guesses.",
    reviewerNote: "Why it matters: Guarantees 100% precision on clean transactions without LLM cost or latency.",
  },
  ai_investigation: {
    title: "Bounded AI Investigation",
    explanation:
      "Autonomous tool-calling investigation applied ONLY to ambiguous discrepancies that fail deterministic matching. Operates under strict anti-hallucination guardrails and can only cite verified evidence from supporting events.",
    reviewerNote: "Why it matters: Solves complex fee revisions, partial refunds, and timing delays without risk of hallucinated ledger entries.",
  },
  precision: {
    title: "Precision (Match Accuracy)",
    explanation:
      "The percentage of reconciliation decisions that were objectively correct when compared against isolated ground truth. Calculated as True Positives / (True Positives + False Positives).",
    reviewerNote: "What to look for: Finance operations demand near-100% precision because false-positive matches corrupt financial books.",
  },
  recall: {
    title: "Recall (Coverage Completeness)",
    explanation:
      "The percentage of all true settlement opportunities that Recon.ai successfully identified and resolved. Calculated as True Positives / (True Positives + False Negatives).",
    reviewerNote: "What to look for: High recall ensures valid transactions are not lost or omitted into manual queues.",
  },
  f1_score: {
    title: "F1 Score (Harmonic Balance)",
    explanation:
      "The harmonic mean of Precision and Recall: 2 × (Precision × Recall) / (Precision + Recall). Provides a balanced, single-number measure of matching quality.",
    reviewerNote: "What to look for: Confirms the system does not artificially inflate precision by refusing to reconcile non-trivial cases.",
  },
  exceptions: {
    title: "Honest Exceptions",
    explanation:
      "Discrepancies that cannot be safely resolved with available evidence. Rather than hallucinating a resolution, Recon.ai intentionally escalates these cases with full audit trails.",
    reviewerNote: "What to look for: Honest escalation prevents unauthorized ledger updates and highlights real settlement risks.",
  },
  financial_leakage: {
    title: "Financial Leakage & Recovery",
    explanation:
      "Monetary discrepancy across the batch. Tracks Detected Leakage (total identified variance), Prevented Leakage (variance resolved via automated investigation), and Recoverable Variance (actionable claims).",
    reviewerNote: "What to look for: Quantifies actual monetary value saved and exposure mitigated.",
  },
  ground_truth: {
    title: "Segregated Ground Truth",
    explanation:
      "Known settlement facts are strictly sequestered in an isolated enclave during reconciliation. Neither the deterministic matcher nor the AI investigator has access to ground truth.",
    reviewerNote: "Why it matters: Prevents data leakage and ensures evaluation metrics are 100% honest and objective.",
  },
  audit_trail: {
    title: "Immutable Audit Trail",
    explanation:
      "An append-only chronological log of every matching decision, bounded AI tool call, parameter change, and human review action with ISO timestamps and cryptographic references.",
    reviewerNote: "Why it matters: Essential for SOX compliance, external auditors, and finance controllers.",
  },
  ask_controller: {
    title: "Grounded Controller Assistant",
    explanation:
      "A conversational FinOps assistant that queries real database transactions and verified run metrics to answer natural language questions. Enforces strict zero-hallucination citation checks.",
    reviewerNote: "What to look for: Answers cite specific order IDs, UTRs, and paise variances directly from the database.",
  },
};

interface InfoTooltipProps {
  concept?: keyof typeof CONCEPT_DEFINITIONS;
  title?: string;
  content?: string | React.ReactNode;
  align?: "left" | "center" | "right";
  size?: "sm" | "md";
  className?: string;
  icon?: "help" | "info";
}

export function InfoTooltip({
  concept,
  title: customTitle,
  content: customContent,
  align = "center",
  size = "sm",
  className = "",
  icon = "help",
}: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const def = concept ? CONCEPT_DEFINITIONS[concept] : null;
  const title = customTitle || def?.title;
  const content = customContent || def?.explanation;
  const note = def?.reviewerNote;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const alignClass =
    align === "left"
      ? "left-0"
      : align === "right"
      ? "right-0"
      : "left-1/2 -translate-x-1/2";

  const IconComponent = icon === "info" ? Info : HelpCircle;
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        aria-label={title || "Information"}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className="text-slate-400 hover:text-cyan-400 focus:text-cyan-300 transition-colors p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
      >
        <IconComponent className={iconSize} />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className={`absolute bottom-full mb-2 z-50 w-72 sm:w-80 rounded-xl bg-slate-950 border border-slate-700/80 p-3.5 shadow-2xl backdrop-blur-xl text-left pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95 ${alignClass}`}
        >
          {title && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 border-b border-slate-800 pb-1.5 mb-2">
              <Info className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span>{title}</span>
            </div>
          )}

          <div className="text-[11px] leading-relaxed text-slate-300">
            {content}
          </div>

          {note && (
            <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] leading-snug text-indigo-300 bg-indigo-950/40 p-1.5 rounded-lg border border-indigo-800/30 font-medium">
              💡 {note}
            </div>
          )}

          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}
