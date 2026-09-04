import { NextRequest, NextResponse } from "next/server";
import { runHistoryStore } from "@/lib/reconciliation/orchestrator";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // 1. Try fetching from database first
    try {
      const dbRuns = await prisma.reconciliationRun.findMany({
        orderBy: { startTime: "desc" },
        take: 20,
        include: {
          dataset: true,
          evaluation: true,
        },
      });

      if (dbRuns && dbRuns.length > 0) {
        return NextResponse.json({
          success: true,
          source: "database",
          runs: dbRuns.map((r) => ({
            runId: r.id,
            datasetId: r.datasetId,
            datasetName: r.dataset?.name || "Synthetic Batch",
            seed: r.dataset?.seed || 2026,
            recordCount: r.totalRecordsProcessed,
            startTime: r.startTime.toISOString(),
            durationMs: r.durationMs || 0,
            matchedCount: r.matchedCount,
            resolvedCount: r.resolvedCount,
            reviewCount: r.reviewCount,
            unresolvedCount: r.unresolvedCount,
            exceptionCount: r.exceptionCount,
            matchRatePercent: Number(((r.matchedCount / (r.totalRecordsProcessed || 1)) * 100).toFixed(1)),
            formattedTotal: `₹${(Number(r.totalValueMinorUnits) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
            formattedLeakage: `₹${(Number(r.financialLeakageMinorUnits) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
          })),
        });
      }
    } catch (dbErr) {
      // Fallback to in-memory store
    }

    // 2. In-memory store fallback
    const memRuns = runHistoryStore.listRuns();
    return NextResponse.json({
      success: true,
      source: "memory",
      runs: memRuns.map((r) => ({
        ...r,
        startTime: r.startTime.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error("[Recon.ai API] List runs failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to list reconciliation runs" },
      { status: 500 }
    );
  }
}
