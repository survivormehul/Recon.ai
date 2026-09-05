import { NextRequest, NextResponse } from "next/server";
import { ExceptionService } from "@/lib/exceptions/exception-service";
import { SyntheticDataGenerator } from "@/lib/generator/synthetic-generator";
import { DeterministicReconciliationEngine } from "@/lib/reconciliation/deterministic-engine";
import { runHistoryStore } from "@/lib/reconciliation/orchestrator";
import { prisma } from "@/lib/prisma";
import { Money } from "@/lib/money";
import { Severity, ExceptionType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const runIdParam = searchParams.get("runId");
    const severity = (searchParams.get("severity") as Severity) || undefined;
    const exceptionType = (searchParams.get("exceptionType") as ExceptionType) || undefined;
    const resolvedParam = searchParams.get("resolved");
    const resolved = resolvedParam !== null ? resolvedParam === "true" : undefined;

    // If no runId is explicitly passed, default to the latest persisted run ID
    let targetRunId = runIdParam || undefined;
    if (!targetRunId) {
      try {
        const latestDbRun = await prisma.reconciliationRun.findFirst({
          orderBy: { startTime: "desc" },
          select: { id: true },
        });
        if (latestDbRun) {
          targetRunId = latestDbRun.id;
        } else {
          const latestMemRun = runHistoryStore.getLatestRun();
          if (latestMemRun) targetRunId = latestMemRun.runId;
        }
      } catch (err) {
        // Fallback to in-memory store
        const latestMemRun = runHistoryStore.getLatestRun();
        if (latestMemRun) targetRunId = latestMemRun.runId;
      }
    }

    // 1. Try fetching from database first
    try {
      const dbExceptions = await ExceptionService.listExceptions({
        runId: targetRunId,
        severity,
        exceptionType,
        resolved,
      });

      // If targetRunId is provided, check if run exists in DB
      let runExistsInDb = false;
      if (targetRunId) {
        const dbRun = await prisma.reconciliationRun.findUnique({
          where: { id: targetRunId },
          select: { id: true, exceptionCount: true },
        });
        if (dbRun) runExistsInDb = true;
      }

      if (dbExceptions.length > 0 || runExistsInDb) {
        const stats = await ExceptionService.getSummaryStats(targetRunId);
        return NextResponse.json({
          success: true,
          source: "database",
          runId: targetRunId,
          exceptions: dbExceptions.map((e) => ({
            ...e,
            monetaryImpactMinorUnits: e.monetaryImpactMinorUnits.toString(),
            decision: e.decision
              ? {
                  ...e.decision,
                  varianceMinorUnits: e.decision.varianceMinorUnits.toString(),
                }
              : null,
          })),
          stats: {
            ...stats,
            totalMonetaryImpactMinorUnits: stats.totalMonetaryImpactMinorUnits.toString(),
          },
        });
      }
    } catch (dbErr) {
      console.warn("[Recon.ai API] Database exception query failed, checking memory:", dbErr);
    }

    // 2. Check in-memory run store if targetRunId is available
    if (targetRunId) {
      const memRun = runHistoryStore.getRun(targetRunId);
      if (memRun) {
        const memExceptions: any[] = [];
        for (const dec of memRun.decisions) {
          for (const exc of dec.exceptions) {
            const excAny = exc as any;
            if (severity && exc.severity !== severity) continue;
            if (exceptionType && exc.exceptionType !== exceptionType) continue;
            if (resolved !== undefined && (excAny.resolved ?? false) !== resolved) continue;

            memExceptions.push({
              id: excAny.id || `exc_${dec.orderId}_${exc.exceptionType}`,
              runId: memRun.runId,
              orderId: dec.orderId,
              exceptionType: exc.exceptionType,
              severity: exc.severity,
              monetaryImpactMinorUnits: exc.monetaryImpactMinorUnits.toString(),
              monetaryImpactFormatted: Money.formatPaise(exc.monetaryImpactMinorUnits),
              title: exc.title,
              description: exc.description,
              recommendedAction: exc.recommendedAction,
              resolved: excAny.resolved ?? false,
              createdAt: excAny.createdAt ? (typeof excAny.createdAt === "string" ? excAny.createdAt : excAny.createdAt.toISOString()) : new Date().toISOString(),
              decision: {
                id: `dec_${dec.orderId}`,
                state: dec.state,
                method: dec.method,
                confidence: dec.confidence,
                varianceMinorUnits: dec.varianceMinorUnits.toString(),
                explanation: dec.explanation,
              },
            });
          }
        }

        let totalImpactPaise = 0n;
        for (const e of memExceptions) {
          totalImpactPaise += BigInt(e.monetaryImpactMinorUnits);
        }

        return NextResponse.json({
          success: true,
          source: "memory",
          runId: targetRunId,
          exceptions: memExceptions,
          stats: {
            totalCount: memExceptions.length,
            openCount: memExceptions.filter((e) => !e.resolved).length,
            resolvedCount: memExceptions.filter((e) => e.resolved).length,
            criticalCount: memExceptions.filter((e) => e.severity === "CRITICAL").length,
            highCount: memExceptions.filter((e) => e.severity === "HIGH").length,
            mediumCount: memExceptions.filter((e) => e.severity === "MEDIUM").length,
            lowCount: memExceptions.filter((e) => e.severity === "LOW").length,
            totalMonetaryImpactMinorUnits: totalImpactPaise.toString(),
            totalMonetaryImpactFormatted: Money.formatPaise(totalImpactPaise),
          },
        });
      }
    }

    // 3. Dynamic generation fallback for instant demo & testing
    const generator = new SyntheticDataGenerator({ seed: 2026, recordCount: 500 });
    const dataset = generator.generate();
    const batchResult = DeterministicReconciliationEngine.reconcileBatch(
      dataset.datasetId,
      dataset.gatewayRecords,
      dataset.bankRecords,
      dataset.ledgerRecords,
      dataset.supportingEvents
    );

    const generatedExceptions: any[] = [];
    for (const dec of batchResult.decisions) {
      for (const exc of dec.exceptions) {
        if (severity && exc.severity !== severity) continue;
        if (exceptionType && exc.exceptionType !== exceptionType) continue;

        generatedExceptions.push({
          id: `exc_${dec.orderId}_${exc.exceptionType}`,
          runId: batchResult.runId,
          orderId: dec.orderId,
          exceptionType: exc.exceptionType,
          severity: exc.severity,
          monetaryImpactMinorUnits: exc.monetaryImpactMinorUnits.toString(),
          monetaryImpactFormatted: Money.format(exc.monetaryImpactMinorUnits),
          title: exc.title,
          description: exc.description,
          recommendedAction: exc.recommendedAction,
          resolved: false,
          createdAt: new Date().toISOString(),
          decision: {
            id: `dec_${dec.orderId}`,
            state: dec.state,
            method: dec.method,
            confidence: dec.confidence,
            varianceMinorUnits: dec.varianceMinorUnits.toString(),
            explanation: dec.explanation,
          },
        });
      }
    }

    let totalImpactPaise = 0n;
    for (const e of generatedExceptions) {
      totalImpactPaise += BigInt(e.monetaryImpactMinorUnits);
    }

    return NextResponse.json({
      success: true,
      source: "generated",
      runId: batchResult.runId,
      exceptions: generatedExceptions,
      stats: {
        totalCount: generatedExceptions.length,
        openCount: generatedExceptions.length,
        resolvedCount: 0,
        criticalCount: generatedExceptions.filter((e) => e.severity === "CRITICAL").length,
        highCount: generatedExceptions.filter((e) => e.severity === "HIGH").length,
        mediumCount: generatedExceptions.filter((e) => e.severity === "MEDIUM").length,
        lowCount: generatedExceptions.filter((e) => e.severity === "LOW").length,
        totalMonetaryImpactMinorUnits: totalImpactPaise.toString(),
        totalMonetaryImpactFormatted: Money.format(totalImpactPaise),
      },
    });
  } catch (error: any) {
    console.error("[Recon.ai API] Exception listing error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to list exceptions" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { exceptionId, actionTaken, notes, actor } = body;

    if (!exceptionId || !actionTaken) {
      return NextResponse.json(
        { success: false, error: "exceptionId and actionTaken are required." },
        { status: 400 }
      );
    }

    const result = await ExceptionService.resolveException({
      exceptionId,
      actionTaken,
      notes,
      actor,
    });

    return NextResponse.json({
      success: true,
      exception: {
        ...result.exception,
        monetaryImpactMinorUnits: result.exception.monetaryImpactMinorUnits.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to resolve exception" },
      { status: 500 }
    );
  }
}
