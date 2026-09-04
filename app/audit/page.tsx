"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  ShieldCheck, 
  Cpu, 
  AlertTriangle, 
  FileText, 
  ChevronDown, 
  ChevronRight,
  Clock,
  Layers,
  CheckCircle2,
  XCircle,
  Database
} from "lucide-react";

function AuditContent() {
  const searchParams = useSearchParams();
  const initialRunId = searchParams.get("runId") || "";

  const [events, setEvents] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedAction, setSelectedAction] = useState<string>("ALL");
  const [selectedActor, setSelectedActor] = useState<string>("ALL");
  const [searchEntity, setSearchEntity] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAuditEvents = async (action: string, actor: string, query: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (initialRunId) params.set("runId", initialRunId);
      if (action !== "ALL") params.set("action", action);
      if (actor !== "ALL") params.set("actor", actor);
      if (query.trim()) params.set("entityId", query.trim());
      params.set("limit", "100");

      const res = await fetch(`/api/audit?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.events || []);
        setTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch audit events:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditEvents(selectedAction, selectedActor, searchEntity);
  }, [selectedAction, selectedActor, initialRunId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAuditEvents(selectedAction, selectedActor, searchEntity);
  };

  const handleExport = () => {
    const exportUrl = initialRunId 
      ? `/api/audit?runId=${initialRunId}&export=true` 
      : `/api/audit?export=true`;
    window.open(exportUrl, "_blank");
  };

  const getActionBadge = (action: string) => {
    if (action.includes("MATCHED") || action.includes("RESOLVED")) {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
    if (action.includes("AI_") || action.includes("TOOL")) {
      return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
    }
    if (action.includes("DISCREPANCY") || action.includes("EXCEPTION")) {
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
    if (action.includes("FAILED")) {
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    }
    return "bg-slate-800 text-slate-300 border-slate-700";
  };

  const getActorBadge = (actor: string) => {
    switch (actor) {
      case "DETERMINISTIC_ENGINE":
        return "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
      case "AI_INVESTIGATOR":
        return "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
      case "ANTI_HALLUCINATION_VALIDATOR":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      default:
        return "text-slate-400 bg-slate-800 border-slate-700";
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <History className="h-4 w-4" />
            Compliance & Verification Trail
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Financial Audit Trail
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Immutable chronological record of every data ingestion, deterministic match rule, AI investigation tool call, and validation check.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors shadow-sm"
          >
            <Download className="h-4 w-4 text-indigo-400" />
            Export Audit Log (JSON)
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-sm">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative sm:col-span-2">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Filter by Order ID or Entity ID..."
            value={searchEntity}
            onChange={(e) => setSearchEntity(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </form>

        {/* Action Filter */}
        <div>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Actions</option>
            <option value="DATASET_INGESTED">Dataset Ingested</option>
            <option value="DETERMINISTIC_MATCHED">Deterministic Matched</option>
            <option value="DISCREPANCY_DETECTED">Discrepancy Detected</option>
            <option value="AI_INVESTIGATION_DISPATCHED">AI Investigation Dispatched</option>
            <option value="TOOL_CALLED">Tool Called</option>
            <option value="VALIDATION_PASSED">Validation Passed</option>
            <option value="DECISION_COMMITTED">Decision Committed</option>
            <option value="EXCEPTION_LOGGED">Exception Logged</option>
            <option value="RUN_COMPLETED">Run Completed</option>
          </select>
        </div>

        {/* Actor Filter */}
        <div>
          <select
            value={selectedActor}
            onChange={(e) => setSelectedActor(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Actors</option>
            <option value="DETERMINISTIC_ENGINE">Deterministic Engine</option>
            <option value="AI_INVESTIGATOR">AI Investigator (Gemini)</option>
            <option value="ANTI_HALLUCINATION_VALIDATOR">Anti-Hallucination Validator</option>
            <option value="RECON_ORCHESTRATOR">Reconciliation Orchestrator</option>
          </select>
        </div>
      </div>

      {/* Events Timeline */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Displaying {events.length} audit events {totalCount > 0 ? `(of ${totalCount} recorded)` : ""}</span>
          <span className="font-mono text-[11px]">Strict Non-Repudiation • Append-Only</span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-400" />
              Loading audit trail events...
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <CheckCircle2 className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              No audit events found matching the filter criteria.
            </div>
          ) : (
            events.map((ev) => {
              const isExpanded = expandedId === ev.id;

              return (
                <div key={ev.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${getActionBadge(ev.action)}`}>
                          {ev.action}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border font-mono ${getActorBadge(ev.actor)}`}>
                          {ev.actor}
                        </span>
                        <span className="font-mono text-white text-xs font-semibold">
                          {ev.entityId}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          ({ev.entityType})
                        </span>
                      </div>

                      {ev.details && typeof ev.details === "object" && (
                        <p className="text-xs text-slate-300 font-sans line-clamp-2">
                          {ev.details.explanation || 
                           ev.details.reasoning ||
                           ev.details.summary ||
                           ev.details.title ||
                           (ev.action === "TOOL_CALLED" ? `Executed ${ev.details.toolName} for ${ev.entityId}` : JSON.stringify(ev.details))}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right text-[11px] font-mono text-slate-500">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {new Date(ev.timestamp).toLocaleTimeString("en-IN", {
                          hour12: false,
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded JSON Inspector */}
                  {isExpanded && ev.details && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-indigo-300 overflow-x-auto">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-sans font-semibold">
                        Complete Event Payload
                      </div>
                      <pre>{JSON.stringify(ev.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-500 rounded-xl bg-slate-900 border border-slate-800">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-400" />
          Loading audit trail visualizer...
        </div>
      }
    >
      <AuditContent />
    </Suspense>
  );
}
