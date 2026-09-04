import { NextRequest, NextResponse } from "next/server";
import { SyntheticDataGenerator } from "@/lib/generator/synthetic-generator";
import { DeterministicReconciliationEngine } from "@/lib/reconciliation/deterministic-engine";
import { ObjectiveEvaluator } from "@/lib/evaluation/evaluator";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId");
    const seed = Number(searchParams.get("seed")) || 2026;
    const recordCount = Number(searchParams.get("recordCount")) || 500;

    // Check if evaluation already exists in DB for runId
    if (runId) {
      try {
        const dbEval = await prisma.evaluationResult.findUnique({
          where: { runId },
        });
        if (dbEval) {
          return NextResponse.json({
            success: true,
            source: "database",
            evaluation: {
              ...dbEval,
              totalValueReconciledMinorUnits: dbEval.totalValueReconciledMinorUnits.toString(),
              totalUnexplainedVarianceMinorUnits: dbEval.totalUnexplainedVarianceMinorUnits.toString(),
              detectedLeakageMinorUnits: dbEval.detectedLeakageMinorUnits.toString(),
              preventedLeakageMinorUnits: dbEval.preventedLeakageMinorUnits.toString(),
            },
          });
        }
      } catch (dbError) {
        // Fall back to on-the-fly execution
      }
    }

    // Run benchmark evaluation on synthetic dataset
    const generator = new SyntheticDataGenerator({ seed, recordCount });
    const dataset = generator.generate();

    const batchResult = DeterministicReconciliationEngine.reconcileBatch(
      dataset.datasetId,
      dataset.gatewayRecords,
      dataset.bankRecords,
      dataset.ledgerRecords,
      dataset.supportingEvents
    );

    const evaluation = ObjectiveEvaluator.evaluate({
      runId: batchResult.runId,
      decisions: batchResult.decisions,
      groundTruths: dataset.groundTruths,
      totalProcessingTimeMs: batchResult.durationMs,
      deterministicDurationMs: batchResult.durationMs,
      aiDurationMs: 0,
      throughputPerSecond: batchResult.throughputPerSecond,
    });

    // Convert bigints to strings for JSON serialization
    const serialized = {
      ...evaluation,
      totalValueReconciledMinorUnits: evaluation.totalValueReconciledMinorUnits.toString(),
      totalUnexplainedVarianceMinorUnits: evaluation.totalUnexplainedVarianceMinorUnits.toString(),
      detectedLeakageMinorUnits: evaluation.detectedLeakageMinorUnits.toString(),
      preventedLeakageMinorUnits: evaluation.preventedLeakageMinorUnits.toString(),
      recoverableMinorUnits: evaluation.recoverableMinorUnits.toString(),
      leakageBreakdown: Object.fromEntries(
        Object.entries(evaluation.leakageBreakdown).map(([k, v]) => [
          k,
          {
            ...v,
            monetaryMinorUnits: v.monetaryMinorUnits.toString(),
            preventedMinorUnits: v.preventedMinorUnits.toString(),
            recoverableMinorUnits: v.recoverableMinorUnits.toString(),
          },
        ])
      ),
    };

    return NextResponse.json({
      success: true,
      source: "calculated",
      evaluation: serialized,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to calculate evaluation" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const seed = Number(body.seed) || 2026;
    const recordCount = Number(body.recordCount) || 500;

    const generator = new SyntheticDataGenerator({ seed, recordCount });
    const dataset = generator.generate();

    const batchResult = DeterministicReconciliationEngine.reconcileBatch(
      dataset.datasetId,
      dataset.gatewayRecords,
      dataset.bankRecords,
      dataset.ledgerRecords,
      dataset.supportingEvents
    );

    const evaluation = ObjectiveEvaluator.evaluate({
      runId: batchResult.runId,
      decisions: batchResult.decisions,
      groundTruths: dataset.groundTruths,
      totalProcessingTimeMs: batchResult.durationMs,
      deterministicDurationMs: batchResult.durationMs,
      aiDurationMs: 0,
      throughputPerSecond: batchResult.throughputPerSecond,
    });

    const serialized = {
      ...evaluation,
      totalValueReconciledMinorUnits: evaluation.totalValueReconciledMinorUnits.toString(),
      totalUnexplainedVarianceMinorUnits: evaluation.totalUnexplainedVarianceMinorUnits.toString(),
      detectedLeakageMinorUnits: evaluation.detectedLeakageMinorUnits.toString(),
      preventedLeakageMinorUnits: evaluation.preventedLeakageMinorUnits.toString(),
      recoverableMinorUnits: evaluation.recoverableMinorUnits.toString(),
      leakageBreakdown: Object.fromEntries(
        Object.entries(evaluation.leakageBreakdown).map(([k, v]) => [
          k,
          {
            ...v,
            monetaryMinorUnits: v.monetaryMinorUnits.toString(),
            preventedMinorUnits: v.preventedMinorUnits.toString(),
            recoverableMinorUnits: v.recoverableMinorUnits.toString(),
          },
        ])
      ),
    };

    return NextResponse.json({
      success: true,
      evaluation: serialized,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Evaluation execution failed" },
      { status: 500 }
    );
  }
}
