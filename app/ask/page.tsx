"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  MessageSquareCode,
  Send,
  Sparkles,
  ShieldCheck,
  TrendingDown,
  AlertTriangle,
  Bot,
  User,
  RefreshCw,
  Clock,
  Layers,
  CheckCircle2,
  HelpCircle,
  Zap,
  ArrowRight,
  ReceiptText
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  citedRecords?: Array<{
    type: "order" | "utr" | "metric" | "exception";
    identifier: string;
    details: string;
  }>;
  groundedFacts?: {
    runId: string;
    recordCount: number;
    matchRatePercent: number;
    totalUnexplainedVariance: string;
    totalLeakageDetected: string;
    totalLeakagePrevented: string;
  };
  providerUsed?: string;
  latencyMs?: number;
}

const SUGGESTED_QUESTIONS = [
  "What is our total unexplained variance across this batch?",
  "How much financial leakage did we detect vs prevent?",
  "Show our independent evaluation metrics (Precision, Recall, F1)",
  "Summarize critical open exceptions requiring human sign-off",
  "Why was ORD-2026-0005 flagged and what was its resolution?",
];

function AskControllerContent() {
  const searchParams = useSearchParams();
  const runIdParam = searchParams.get("runId") || undefined;

  const [inputQuestion, setInputQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | undefined>(runIdParam);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial welcome message
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `### Welcome to Recon.ai Finance Controller Assistant\n\nI am your **grounded financial intelligence agent** for this reconciliation batch. Every figure, Order ID, and resolution I present is strictly anchored in deterministic data and validated multi-source evidence.\n\n**What would you like to investigate?**`,
        timestamp: new Date(),
        citedRecords: [],
      },
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: q,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuestion("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/controller/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          runId: activeRunId,
          history: messages.slice(-4).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.groundedFacts?.runId && data.groundedFacts.runId !== "none") {
          setActiveRunId(data.groundedFacts.runId);
        }

        const assistantMessage: Message = {
          id: `assistant_${Date.now()}`,
          role: "assistant",
          content: data.answer,
          timestamp: new Date(),
          citedRecords: data.citedRecords,
          groundedFacts: data.groundedFacts,
          providerUsed: data.providerUsed,
          latencyMs: data.latencyMs,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "assistant",
            content: `**Query Error:** ${data.error || "Failed to process query."}`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          content: `**Connection Error:** Unable to reach the Recon.ai Controller Engine.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 flex flex-col h-[calc(100vh-8.5rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <MessageSquareCode className="h-4 w-4" />
            Autonomous Controller Intelligence
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            Ask the Controller
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono font-normal">
              Grounded Natural Language
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Query financial leakage, variance breakdowns, specific transaction audits, and objective evaluation metrics in plain English.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Anti-Hallucination Verified</span>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        {/* Messages Feed */}
        <div className="flex-1 p-5 overflow-y-auto space-y-6">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
                  <Bot className="h-4 w-4 text-white" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-xl p-4 text-sm leading-relaxed space-y-3 ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/10"
                    : "bg-slate-950/90 border border-slate-800 text-slate-200 rounded-tl-none shadow-md"
                }`}
              >
                {/* Content */}
                <div className="prose prose-invert prose-sm max-w-none space-y-2 whitespace-pre-wrap font-sans">
                  {m.content}
                </div>

                {/* Cited Records Drawer */}
                {m.citedRecords && m.citedRecords.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <ReceiptText className="h-3.5 w-3.5 text-cyan-400" />
                      Cited Verifiable Evidence
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {m.citedRecords.map((cite, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg text-xs"
                        >
                          <div className="flex items-center justify-between font-mono font-semibold text-cyan-300">
                            <span>{cite.identifier}</span>
                            <span className="text-[10px] text-slate-500 uppercase px-1.5 py-0.2 rounded bg-slate-800">
                              {cite.type}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] mt-0.5">{cite.details}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grounded Metadata Pill */}
                {m.groundedFacts && m.groundedFacts.runId !== "none" && (
                  <div className="mt-2 pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono">
                    <div className="flex items-center gap-3">
                      <span>Batch: {m.groundedFacts.recordCount} records</span>
                      <span>Match Rate: {m.groundedFacts.matchRatePercent}%</span>
                      <span>Leakage: {m.groundedFacts.totalLeakageDetected}</span>
                    </div>
                    {m.latencyMs && (
                      <span className="text-slate-400">
                        {m.providerUsed === "gemini" ? "Gemini 3.6 Flash" : "Grounded Engine"} • {m.latencyMs}ms
                      </span>
                    )}
                  </div>
                )}
              </div>

              {m.role === "user" && (
                <div className="h-8 w-8 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0 shadow-md">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3.5 justify-start">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shrink-0 animate-pulse">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 rounded-tl-none flex items-center gap-3">
                <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
                <span>Consulting multi-source reconciliation data & grounding facts...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Queries Chips */}
        <div className="p-3 bg-slate-950/60 border-t border-slate-800/80 overflow-x-auto shrink-0 flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-400" />
            Suggestions:
          </span>
          {SUGGESTED_QUESTIONS.map((suggestion, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(suggestion)}
              disabled={isLoading}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputQuestion);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask about unexplained variance, leakage, specific Order IDs (e.g. ORD-2026-0005)..."
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
            />
            <button
              type="submit"
              disabled={!inputQuestion.trim() || isLoading}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex items-center gap-2 shrink-0"
            >
              <span>Ask</span>
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AskControllerPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-500 rounded-xl bg-slate-900 border border-slate-800">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-cyan-400" />
          Loading Controller Assistant...
        </div>
      }
    >
      <AskControllerContent />
    </Suspense>
  );
}
