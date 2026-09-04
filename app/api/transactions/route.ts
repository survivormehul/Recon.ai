import { NextRequest, NextResponse } from "next/server";
import { runHistoryStore, ReconciliationOrchestrator } from "@/lib/reconciliation/orchestrator";
import { DecisionState } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId");
    const status = searchParams.get("status") as DecisionState | null;
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 25));

    // Get run from store, or if none exists yet, trigger an initial fast demo run
    let run = runId ? runHistoryStore.getRun(runId) : runHistoryStore.getLatestRun();

    if (!run) {
      // Execute initial run with offline fallback so the explorer is instantly populated
      run = await ReconciliationOrchestrator.executeRun({
        seed: 2026,
        recordCount: 500,
        useAi: true,
        aiProvider: "offline_fallback",
        persistToDb: true,
      });
    }

    let items = run.decisions;

    // Filter by decision status if provided
    if (status) {
      items = items.filter((d) => d.state === status);
    }

    // Filter by search term (orderId, reference, UTR, method)
    if (search) {
      items = items.filter((d) => {
        const orderMatch = d.orderId.toLowerCase().includes(search);
        const utrMatch = d.bankRecord?.utrReference.toLowerCase().includes(search) || false;
        const refMatch = d.gatewayRecord?.rawReference?.toLowerCase().includes(search) || false;
        const methodMatch = d.method.toLowerCase().includes(search);
        return orderMatch || utrMatch || refMatch || methodMatch;
      });
    }

    const totalCount = items.length;
    const totalPages = Math.ceil(totalCount / limit);
    const paginatedItems = items.slice((page - 1) * limit, page * limit);

    // Format items for clean UI rendering
    const formatted = paginatedItems.map((d) => {
      const grossPaise = d.gatewayRecord?.grossAmountMinorUnits || d.ledgerRecord?.expectedAmountMinorUnits || 0n;
      const netPaise = d.gatewayRecord?.netAmountMinorUnits || d.bankRecord?.creditAmountMinorUnits || 0n;
      const bankPaise = d.bankRecord?.creditAmountMinorUnits || 0n;
      const variancePaise = d.varianceMinorUnits;

      return {
        orderId: d.orderId,
        state: d.state,
        method: d.method,
        confidence: d.confidence,
        confidencePercent: Math.round(d.confidence * 100),
        variancePaise: variancePaise.toString(),
        varianceFormatted: `₹${(Number(variancePaise) / 100).toFixed(2)}`,
        explanation: d.explanation,
        // Gateway record
        gateway: d.gatewayRecord ? {
          transactionId: d.gatewayRecord.transactionId,
          orderId: d.gatewayRecord.orderId,
          grossFormatted: `₹${(Number(d.gatewayRecord.grossAmountMinorUnits) / 100).toFixed(2)}`,
          netFormatted: `₹${(Number(d.gatewayRecord.netAmountMinorUnits) / 100).toFixed(2)}`,
          feeFormatted: `₹${(Number(d.gatewayRecord.feeMinorUnits) / 100).toFixed(2)}`,
          taxFormatted: `₹${(Number(d.gatewayRecord.taxMinorUnits) / 100).toFixed(2)}`,
          currency: d.gatewayRecord.currency,
          paymentMethod: d.gatewayRecord.paymentMethod,
          paymentStatus: d.gatewayRecord.paymentStatus,
          reference: d.gatewayRecord.rawReference,
          transactionTime: d.gatewayRecord.transactionTime,
        } : null,
        // Bank record
        bank: d.bankRecord ? {
          utrReference: d.bankRecord.utrReference,
          creditFormatted: `₹${(Number(d.bankRecord.creditAmountMinorUnits) / 100).toFixed(2)}`,
          accountMasked: d.bankRecord.accountNumberMasked,
          rawDescription: d.bankRecord.rawDescription,
          isBatched: d.bankRecord.isBatched,
          batchCount: d.bankRecord.batchCount,
          valueDate: d.bankRecord.valueDate,
        } : null,
        // Ledger record
        ledger: d.ledgerRecord ? {
          journalEntryId: d.ledgerRecord.journalEntryId,
          internalReference: d.ledgerRecord.internalReference,
          expectedFormatted: `₹${(Number(d.ledgerRecord.expectedAmountMinorUnits) / 100).toFixed(2)}`,
          accountCode: d.ledgerRecord.accountCode,
          merchantId: d.ledgerRecord.merchantId,
          ledgerDate: d.ledgerRecord.ledgerDate,
        } : null,
        evidenceItems: d.evidenceItems.map((e) => ({
          evidenceType: e.evidenceType,
          sourceRecordId: e.sourceRecordId,
          sourceTable: e.sourceTable,
          description: e.description,
          monetaryImpactFormatted: `₹${(Number(e.monetaryImpactMinorUnits) / 100).toFixed(2)}`,
        })),
        exceptions: d.exceptions.map((exc) => ({
          exceptionType: exc.exceptionType,
          severity: exc.severity,
          title: exc.title,
          description: exc.description,
          recommendedAction: exc.recommendedAction,
          monetaryImpactFormatted: `₹${(Number(exc.monetaryImpactMinorUnits) / 100).toFixed(2)}`,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      runId: run.runId,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
      statusSummary: {
        total: run.recordCount,
        matched: run.metrics.matchedCount,
        resolved: run.metrics.resolvedCount,
        review: run.metrics.reviewCount,
        unresolved: run.metrics.unresolvedCount,
        duplicate: run.metrics.duplicateCount,
        missing: run.metrics.missingCount,
        conflict: run.metrics.conflictCount,
      },
      transactions: formatted,
    });
  } catch (error: any) {
    console.error("[Recon.ai API] Get transactions failed:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to fetch transactions" }, { status: 500 });
  }
}
