import { NextRequest, NextResponse } from "next/server";
import { ReconciliationOrchestrator, OrchestratedRunResult } from "@/lib/reconciliation/orchestrator";
import { AiProviderType } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const seed = typeof body.seed === "number" ? body.seed : 2026;
    const recordCount = typeof body.recordCount === "number" ? body.recordCount : 500;
    const useAi = typeof body.useAi === "boolean" ? body.useAi : true;
    const aiProvider = (body.aiProvider as AiProviderType) || undefined;

    const result: OrchestratedRunResult = await ReconciliationOrchestrator.executeRun({
      seed,
      recordCount,
      useAi,
      aiProvider,
      persistToDb: true,
    });

    // Safely serialize bigints for JSON delivery
    const serialized = {
      success: true,
      runId: result.runId,
      datasetId: result.datasetId,
      seed: result.seed,
      recordCount: result.recordCount,
      status: result.status,
      startTime: result.startTime.toISOString(),
      endTime: result.endTime.toISOString(),
      durationMs: result.durationMs,
      stageTimings: result.stageTimings,
      metrics: result.metrics,
      financials: {
        ...result.financials,
        totalValueMinorUnits: result.financials.totalValueMinorUnits.toString(),
        reconciledValueMinorUnits: result.financials.reconciledValueMinorUnits.toString(),
        unresolvedValueMinorUnits: result.financials.unresolvedValueMinorUnits.toString(),
        financialLeakageMinorUnits: result.financials.financialLeakageMinorUnits.toString(),
        preventedLeakageMinorUnits: result.financials.preventedLeakageMinorUnits.toString(),
        recoverableMinorUnits: result.financials.recoverableMinorUnits.toString(),
      },
      evaluation: {
        ...result.evaluation,
        totalValueReconciledMinorUnits: result.evaluation.totalValueReconciledMinorUnits.toString(),
        totalUnexplainedVarianceMinorUnits: result.evaluation.totalUnexplainedVarianceMinorUnits.toString(),
        detectedLeakageMinorUnits: result.evaluation.detectedLeakageMinorUnits.toString(),
        preventedLeakageMinorUnits: result.evaluation.preventedLeakageMinorUnits.toString(),
        recoverableMinorUnits: result.evaluation.recoverableMinorUnits.toString(),
        leakageBreakdown: Object.fromEntries(
          Object.entries(result.evaluation.leakageBreakdown || {}).map(([k, val]) => {
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
      // Include lightweight decision preview (first 50) for immediate UI consumption
      decisionsPreview: result.decisions.slice(0, 50).map((d) => ({
        orderId: d.orderId,
        state: d.state,
        method: d.method,
        confidence: d.confidence,
        varianceMinorUnits: d.varianceMinorUnits.toString(),
        varianceFormatted: `₹${(Number(d.varianceMinorUnits) / 100).toFixed(2)}`,
        explanation: d.explanation,
        gatewayGrossFormatted: d.gatewayRecord ? `₹${(Number(d.gatewayRecord.grossAmountMinorUnits) / 100).toFixed(2)}` : "--",
        gatewayNetFormatted: d.gatewayRecord ? `₹${(Number(d.gatewayRecord.netAmountMinorUnits) / 100).toFixed(2)}` : "--",
        bankCreditFormatted: d.bankRecord ? `₹${(Number(d.bankRecord.creditAmountMinorUnits) / 100).toFixed(2)}` : "--",
        bankUtr: d.bankRecord?.utrReference || "--",
        exceptionsCount: d.exceptions.length,
        evidenceCount: d.evidenceItems.length,
      })),
    };

    return NextResponse.json(serialized);
  } catch (error: any) {
    console.error("[Recon.ai API] Run failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Reconciliation run execution failed",
      },
      { status: 500 }
    );
  }
}
