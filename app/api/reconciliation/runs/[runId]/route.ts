import { NextRequest, NextResponse } from "next/server";
import { runHistoryStore } from "@/lib/reconciliation/orchestrator";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const runId = params.runId;
    if (!runId) {
      return NextResponse.json({ success: false, error: "Missing runId parameter" }, { status: 400 });
    }

    // 1. Check in-memory run store first for instant response
    const memRun = runHistoryStore.getRun(runId);
    if (memRun) {
      return NextResponse.json({
        success: true,
        source: "memory",
        run: {
          runId: memRun.runId,
          datasetId: memRun.datasetId,
          seed: memRun.seed,
          recordCount: memRun.recordCount,
          status: memRun.status,
          startTime: memRun.startTime.toISOString(),
          endTime: memRun.endTime.toISOString(),
          durationMs: memRun.durationMs,
          stageTimings: memRun.stageTimings,
          metrics: memRun.metrics,
          financials: {
            ...memRun.financials,
            totalValueMinorUnits: memRun.financials.totalValueMinorUnits.toString(),
            reconciledValueMinorUnits: memRun.financials.reconciledValueMinorUnits.toString(),
            unresolvedValueMinorUnits: memRun.financials.unresolvedValueMinorUnits.toString(),
            financialLeakageMinorUnits: memRun.financials.financialLeakageMinorUnits.toString(),
            preventedLeakageMinorUnits: memRun.financials.preventedLeakageMinorUnits.toString(),
            recoverableMinorUnits: memRun.financials.recoverableMinorUnits.toString(),
          },
          evaluation: {
            ...memRun.evaluation,
            totalValueReconciledMinorUnits: memRun.evaluation.totalValueReconciledMinorUnits.toString(),
            totalUnexplainedVarianceMinorUnits: memRun.evaluation.totalUnexplainedVarianceMinorUnits.toString(),
            detectedLeakageMinorUnits: memRun.evaluation.detectedLeakageMinorUnits.toString(),
            preventedLeakageMinorUnits: memRun.evaluation.preventedLeakageMinorUnits.toString(),
            recoverableMinorUnits: memRun.evaluation.recoverableMinorUnits.toString(),
            leakageBreakdown: Object.fromEntries(
              Object.entries(memRun.evaluation.leakageBreakdown || {}).map(([k, val]) => {
                const v = val as any;
                return [
                  k,
                  {
                    category: v.category,
                    count: v.count,
                    detectedFormatted: v.detectedFormatted,
                    preventedFormatted: v.preventedFormatted,
                    recoverableFormatted: v.recoverableFormatted,
                    detectedMinorUnits: v.detectedMinorUnits?.toString(),
                    preventedMinorUnits: v.preventedMinorUnits?.toString(),
                    recoverableMinorUnits: v.recoverableMinorUnits?.toString(),
                  },
                ];
              })
            ),
          },
          decisions: memRun.decisions.map((d) => ({
            orderId: d.orderId,
            state: d.state,
            method: d.method,
            confidence: d.confidence,
            varianceMinorUnits: d.varianceMinorUnits.toString(),
            explanation: d.explanation,
            gatewayRecord: d.gatewayRecord ? {
              ...d.gatewayRecord,
              grossAmountMinorUnits: d.gatewayRecord.grossAmountMinorUnits.toString(),
              netAmountMinorUnits: d.gatewayRecord.netAmountMinorUnits.toString(),
              feeMinorUnits: d.gatewayRecord.feeMinorUnits.toString(),
              taxMinorUnits: d.gatewayRecord.taxMinorUnits.toString(),
            } : null,
            bankRecord: d.bankRecord ? {
              ...d.bankRecord,
              creditAmountMinorUnits: d.bankRecord.creditAmountMinorUnits.toString(),
            } : null,
            ledgerRecord: d.ledgerRecord ? {
              ...d.ledgerRecord,
              expectedAmountMinorUnits: d.ledgerRecord.expectedAmountMinorUnits.toString(),
              expectedNetMinorUnits: d.ledgerRecord.expectedNetMinorUnits.toString(),
            } : null,
            evidenceItems: d.evidenceItems.map((e) => ({
              ...e,
              monetaryImpactMinorUnits: e.monetaryImpactMinorUnits.toString(),
            })),
            exceptions: d.exceptions.map((exc) => ({
              ...exc,
              monetaryImpactMinorUnits: exc.monetaryImpactMinorUnits.toString(),
            })),
          })),
        },
      });
    }

    // 2. Try fetching from database
    const dbRun = await prisma.reconciliationRun.findUnique({
      where: { id: runId },
      include: {
        dataset: true,
        evaluation: true,
        decisions: {
          include: {
            evidenceItems: true,
            exceptions: true,
            investigation: true,
          },
          take: 200,
        },
      },
    });

    if (!dbRun) {
      return NextResponse.json({ success: false, error: "Reconciliation run not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      source: "database",
      run: {
        runId: dbRun.id,
        datasetId: dbRun.datasetId,
        status: dbRun.status,
        startTime: dbRun.startTime.toISOString(),
        endTime: dbRun.endTime?.toISOString() || null,
        durationMs: dbRun.durationMs || 0,
        metrics: {
          totalRecords: dbRun.totalRecordsProcessed,
          matchedCount: dbRun.matchedCount,
          resolvedCount: dbRun.resolvedCount,
          reviewCount: dbRun.reviewCount,
          unresolvedCount: dbRun.unresolvedCount,
          duplicateCount: dbRun.duplicateCount,
          missingCount: dbRun.missingCount,
          conflictCount: dbRun.conflictCount,
          exceptionCount: dbRun.exceptionCount,
          aiInvestigationsCount: dbRun.aiInvestigationCount,
          matchRatePercent: Number(((dbRun.matchedCount / (dbRun.totalRecordsProcessed || 1)) * 100).toFixed(1)),
          throughputPerSecond: dbRun.throughputPerSecond,
        },
        financials: {
          totalValueMinorUnits: dbRun.totalValueMinorUnits.toString(),
          reconciledValueMinorUnits: dbRun.reconciledValueMinorUnits.toString(),
          unresolvedValueMinorUnits: dbRun.unresolvedValueMinorUnits.toString(),
          financialLeakageMinorUnits: dbRun.financialLeakageMinorUnits.toString(),
        },
        evaluation: dbRun.evaluation ? {
          precision: dbRun.evaluation.precision,
          recall: dbRun.evaluation.recall,
          f1: dbRun.evaluation.f1Score,
          matchRate: dbRun.evaluation.matchRate,
          resolutionRate: dbRun.evaluation.resolutionRate,
          totalValueReconciledMinorUnits: dbRun.evaluation.totalValueReconciledMinorUnits.toString(),
          totalUnexplainedVarianceMinorUnits: dbRun.evaluation.totalUnexplainedVarianceMinorUnits.toString(),
          detectedLeakageMinorUnits: dbRun.evaluation.detectedLeakageMinorUnits.toString(),
          preventedLeakageMinorUnits: dbRun.evaluation.preventedLeakageMinorUnits.toString(),
          leakageBreakdown: dbRun.evaluation.leakageBreakdown,
        } : null,
        decisions: dbRun.decisions.map((d) => ({
          orderId: d.orderId,
          state: d.state,
          method: d.method,
          confidence: d.confidence,
          varianceMinorUnits: d.varianceMinorUnits.toString(),
          explanation: d.explanation,
          evidenceItems: d.evidenceItems.map((e) => ({
            ...e,
            monetaryImpactMinorUnits: e.monetaryImpactMinorUnits.toString(),
          })),
          exceptions: d.exceptions.map((e) => ({
            ...e,
            monetaryImpactMinorUnits: e.monetaryImpactMinorUnits.toString(),
          })),
          investigation: d.investigation,
        })),
      },
    });
  } catch (error: any) {
    console.error("[Recon.ai API] Get run failed:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to fetch run" }, { status: 500 });
  }
}
