"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  ArrowLeftRight, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ChevronRight, 
  X, 
  Building2, 
  CreditCard, 
  FileText, 
  Sparkles, 
  ShieldCheck,
  RefreshCw,
  ExternalLink
} from "lucide-react";

function TransactionsContent() {
  const searchParams = useSearchParams();
  const initialRunId = searchParams.get("runId") || "";

  const [transactions, setTransactions] = useState<any[]>([]);
  const [statusSummary, setStatusSummary] = useState<any>({});
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedTxn, setSelectedTxn] = useState<any | null>(null);

  const fetchTransactions = async (status: string, search: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (initialRunId) params.set("runId", initialRunId);
      if (status !== "ALL") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      params.set("limit", "50");

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions || []);
        setStatusSummary(data.statusSummary || {});
      }
    } catch (err) {
      console.error("Failed to load transactions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(selectedStatus, searchQuery);
  }, [selectedStatus, initialRunId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions(selectedStatus, searchQuery);
  };

  const getStatusBadge = (state: string) => {
    switch (state) {
      case "MATCHED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "RESOLVED":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "REVIEW":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "UNRESOLVED":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "DUPLICATE":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "MISSING":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "CONFLICT":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <ArrowLeftRight className="h-4 w-4" />
            Financial Audit Grid
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Transactions Explorer
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Searchable multi-source transactions with 3-way reconciliation traces, fee & GST breakdowns, and bounded AI investigation records.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative w-72">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search Order ID, UTR, Ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 text-xs scrollbar-none">
        {[
          { id: "ALL", label: "All Records", count: statusSummary.total },
          { id: "MATCHED", label: "Matched", count: statusSummary.matched },
          { id: "RESOLVED", label: "AI Resolved", count: statusSummary.resolved },
          { id: "REVIEW", label: "Review Required", count: statusSummary.review },
          { id: "UNRESOLVED", label: "Unresolved", count: statusSummary.unresolved },
          { id: "DUPLICATE", label: "Duplicates", count: statusSummary.duplicate },
          { id: "MISSING", label: "Missing Records", count: statusSummary.missing },
          { id: "CONFLICT", label: "Conflicts", count: statusSummary.conflict },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedStatus(tab.id)}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedStatus === tab.id
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Transactions Data Table */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Order ID & Status</th>
                <th className="py-3 px-4">Method & Confidence</th>
                <th className="py-3 px-4">Gateway Gross / Net</th>
                <th className="py-3 px-4">Bank Credit & UTR</th>
                <th className="py-3 px-4">Ledger Expected</th>
                <th className="py-3 px-4 text-right">Variance</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading reconciliation records...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No transactions found matching the selected filters.
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => (
                  <tr
                    key={txn.orderId}
                    onClick={() => setSelectedTxn(txn)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    {/* Order ID & Status Badge */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-white">{txn.orderId}</div>
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border mt-1 ${getStatusBadge(txn.state)}`}>
                        {txn.state}
                      </span>
                    </td>

                    {/* Method & Confidence */}
                    <td className="py-3 px-4">
                      <div className="text-slate-300 font-medium truncate max-w-[140px]" title={txn.method}>
                        {txn.method}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <span>Confidence:</span>
                        <span className="text-indigo-400 font-mono font-semibold">{txn.confidencePercent}%</span>
                      </div>
                    </td>

                    {/* Gateway Gross / Net */}
                    <td className="py-3 px-4">
                      {txn.gateway ? (
                        <>
                          <div className="font-medium text-white">{txn.gateway.grossFormatted}</div>
                          <div className="text-[11px] text-slate-500">Net: {txn.gateway.netFormatted}</div>
                        </>
                      ) : (
                        <span className="text-slate-600 italic">No record</span>
                      )}
                    </td>

                    {/* Bank Credit & UTR */}
                    <td className="py-3 px-4">
                      {txn.bank ? (
                        <>
                          <div className="font-medium text-emerald-400">{txn.bank.creditFormatted}</div>
                          <div className="text-[11px] font-mono text-slate-500 truncate max-w-[150px]" title={txn.bank.utrReference}>
                            {txn.bank.utrReference}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-600 italic">No credit</span>
                      )}
                    </td>

                    {/* Ledger Expected */}
                    <td className="py-3 px-4">
                      {txn.ledger ? (
                        <>
                          <div className="font-medium text-white">{txn.ledger.expectedFormatted}</div>
                          <div className="text-[11px] font-mono text-slate-500">Acc: {txn.ledger.accountCode}</div>
                        </>
                      ) : (
                        <span className="text-slate-600 italic">No entry</span>
                      )}
                    </td>

                    {/* Variance */}
                    <td className="py-3 px-4 text-right">
                      <div className={`font-mono font-bold ${
                        txn.variancePaise === "0" ? "text-slate-400" : "text-rose-400"
                      }`}>
                        {txn.varianceFormatted}
                      </div>
                      {txn.variancePaise !== "0" && (
                        <span className="text-[10px] text-rose-500/80 block">Discrepancy</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTxn(txn);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3-Way Reconciliation Detail Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white font-mono">{selectedTxn.orderId}</span>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded border ${getStatusBadge(selectedTxn.state)}`}>
                    {selectedTxn.state}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                    Confidence: {selectedTxn.confidencePercent}%
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Method: <span className="text-slate-300 font-mono">{selectedTxn.method}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTxn(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Explanation Banner */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block">
                Reconciliation Reasoning
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedTxn.explanation}
              </p>
            </div>

            {/* 3-Way Reconciliation Trace Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Gateway Card */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
                  <CreditCard className="h-4 w-4" />
                  Gateway Record
                </div>
                {selectedTxn.gateway ? (
                  <div className="space-y-1.5 text-xs text-slate-400 font-sans">
                    <div className="flex justify-between">
                      <span>Gross:</span>
                      <span className="font-semibold text-white">{selectedTxn.gateway.grossFormatted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fee:</span>
                      <span className="text-slate-300">{selectedTxn.gateway.feeFormatted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST / Tax:</span>
                      <span className="text-slate-300">{selectedTxn.gateway.taxFormatted}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800/80 pt-1">
                      <span>Net Settlement:</span>
                      <span className="font-semibold text-emerald-400">{selectedTxn.gateway.netFormatted}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 pt-1 truncate" title={selectedTxn.gateway.reference}>
                      Ref: {selectedTxn.gateway.reference || "N/A"}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No gateway settlement record found.</p>
                )}
              </div>

              {/* Bank Card */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                  <Building2 className="h-4 w-4" />
                  Bank Statement
                </div>
                {selectedTxn.bank ? (
                  <div className="space-y-1.5 text-xs text-slate-400 font-sans">
                    <div className="flex justify-between">
                      <span>Credit Amount:</span>
                      <span className="font-semibold text-emerald-400">{selectedTxn.bank.creditFormatted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Account:</span>
                      <span className="text-slate-300 font-mono">{selectedTxn.bank.accountMasked}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Batched:</span>
                      <span className="text-slate-300">{selectedTxn.bank.isBatched ? `Yes (${selectedTxn.bank.batchCount})` : "1-to-1"}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 border-t border-slate-800/80 pt-1 truncate" title={selectedTxn.bank.utrReference}>
                      UTR: {selectedTxn.bank.utrReference}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No bank credit statement found.</p>
                )}
              </div>

              {/* Ledger Card */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
                  <FileText className="h-4 w-4" />
                  Internal Ledger
                </div>
                {selectedTxn.ledger ? (
                  <div className="space-y-1.5 text-xs text-slate-400 font-sans">
                    <div className="flex justify-between">
                      <span>Expected:</span>
                      <span className="font-semibold text-white">{selectedTxn.ledger.expectedFormatted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Account Code:</span>
                      <span className="text-slate-300 font-mono">{selectedTxn.ledger.accountCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Merchant ID:</span>
                      <span className="text-slate-300 font-mono">{selectedTxn.ledger.merchantId}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 border-t border-slate-800/80 pt-1 truncate" title={selectedTxn.ledger.journalEntryId}>
                      JE: {selectedTxn.ledger.journalEntryId}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No ledger entry found.</p>
                )}
              </div>
            </div>

            {/* Evidence & Exceptions Accordion */}
            {selectedTxn.evidenceItems && selectedTxn.evidenceItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Verified Evidence Items ({selectedTxn.evidenceItems.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {selectedTxn.evidenceItems.map((ev: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                      <div className="flex justify-between font-mono text-[11px]">
                        <span className="text-indigo-400 font-semibold">{ev.evidenceType}</span>
                        <span className="text-slate-400">{ev.monetaryImpactFormatted}</span>
                      </div>
                      <p className="text-slate-300 text-[11px]">{ev.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-500 rounded-xl bg-slate-900 border border-slate-800">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-400" />
          Loading transactions explorer...
        </div>
      }
    >
      <TransactionsContent />
    </Suspense>
  );
}
