import { NextRequest, NextResponse } from "next/server";
import { ExceptionService } from "@/lib/exceptions/exception-service";
import { SyntheticDataGenerator } from "@/lib/generator/synthetic-generator";
import { DeterministicReconciliationEngine } from "@/lib/reconciliation/deterministic-engine";
import { Money } from "@/lib/money";
import { Severity, ExceptionType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId") || undefined;
    const severity = (searchParams.get("severity") as Severity) || undefined;
    const exceptionType = (searchParams.get("exceptionType") as ExceptionType) || undefined;
    const resolvedParam = searchParams.get("resolved");
    const resolved = resolvedParam !== null ? resolvedParam === "true" : undefined;

    // Try fetching from database first
    const dbExceptions = await ExceptionService.listExceptions({
      runId,
      severity,
      exceptionType,
      resolved,
    });

    if (dbExceptions.length > 0) {
      const stats = await ExceptionService.getSummaryStats(runId);
      return NextResponse.json({
        success: true,
        source: "database",
        exceptions: dbExceptions.map((e) => ({
          ...e,
          monetaryImpactMinorUnits: e.monetaryImpactMinorUnits.toString(),
        })),
        stats: {
          ...stats,
          totalMonetaryImpactMinorUnits: stats.totalMonetaryImpactMinorUnits.toString(),
        },
      });
    }

    // Dynamic generation fallback for instant demo & testing
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
