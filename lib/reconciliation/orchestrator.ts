import { SyntheticDataGenerator } from "../generator/synthetic-generator";
import { GeneratedDataset } from "../generator/types";
import { 
  DeterministicReconciliationEngine, 
  BatchReconciliationResult, 
  ReconciliationResultItem,
  DecisionEvidence 
} from "./deterministic-engine";
import { AiInvestigator } from "../ai/investigator";
import { InvestigationRequest, AiProviderType } from "../ai/types";
import { ObjectiveEvaluator, ComprehensiveEvaluationResult } from "../evaluation/evaluator";
import { Money } from "../money";
import { prisma } from "../prisma";
import { DecisionState, Severity, ExceptionType, RunStatus } from "@prisma/client";
import { AuditService, auditMemoryStore } from "../audit/audit-service";

export interface RunOrchestrationOptions {
  seed?: number;
  recordCount?: number;
  useAi?: boolean;
  aiProvider?: AiProviderType;
  persistToDb?: boolean;
}

export interface OrchestratedRunResult {
  runId: string;
  datasetId: string;
  seed: number;
  recordCount: number;
  status: RunStatus;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  stageTimings: {
    deterministicMs: number;
    aiInvestigationMs: number;
    evaluationMs: number;
  };
  metrics: {
    totalRecords: number;
    matchedCount: number;
    resolvedCount: number;
    reviewCount: number;
    unresolvedCount: number;
    duplicateCount: number;
    missingCount: number;
    conflictCount: number;
    exceptionCount: number;
    aiInvestigationsCount: number;
    matchRatePercent: number;
    resolutionRatePercent: number;
    falseResolutionRatePercent: number;
    throughputPerSecond: number;
  };
  financials: {
    totalValueMinorUnits: bigint;
    reconciledValueMinorUnits: bigint;
    unresolvedValueMinorUnits: bigint;
    financialLeakageMinorUnits: bigint;
    preventedLeakageMinorUnits: bigint;
    recoverableMinorUnits: bigint;
    formattedTotal: string;
    formattedReconciled: string;
    formattedUnresolved: string;
    formattedLeakage: string;
    formattedPrevented: string;
    formattedRecoverable: string;
  };
  decisions: ReconciliationResultItem[];
  evaluation: ComprehensiveEvaluationResult;
}

// In-Memory Global Run Store to guarantee fast access and graceful fallback
class RunHistoryStore {
  private runs: Map<string, OrchestratedRunResult> = new Map();
  private latestRunId: string | null = null;

  public saveRun(run: OrchestratedRunResult): void {
    this.runs.set(run.runId, run);
    this.latestRunId = run.runId;
  }

  public getRun(runId: string): OrchestratedRunResult | undefined {
    return this.runs.get(runId);
  }

  public getLatestRun(): OrchestratedRunResult | undefined {
    if (!this.latestRunId) return undefined;
    return this.runs.get(this.latestRunId);
  }

  public listRuns(): Array<{
    runId: string;
    datasetId: string;
    seed: number;
    recordCount: number;
    startTime: Date;
    durationMs: number;
    matchedCount: number;
    resolvedCount: number;
    exceptionCount: number;
    matchRatePercent: number;
    formattedTotal: string;
    formattedLeakage: string;
  }> {
    return Array.from(this.runs.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .map((r) => ({
        runId: r.runId,
        datasetId: r.datasetId,
        seed: r.seed,
        recordCount: r.recordCount,
        startTime: r.startTime,
        durationMs: r.durationMs,
        matchedCount: r.metrics.matchedCount,
        resolvedCount: r.metrics.resolvedCount,
        exceptionCount: r.metrics.exceptionCount,
        matchRatePercent: r.metrics.matchRatePercent,
        formattedTotal: r.financials.formattedTotal,
        formattedLeakage: r.financials.formattedLeakage,
      }));
  }
}

// Global singleton instance across Next.js module reloads
const globalForRuns = global as unknown as { reconRunStore?: RunHistoryStore };
export const runHistoryStore = globalForRuns.reconRunStore || new RunHistoryStore();
if (process.env.NODE_ENV !== "production") globalForRuns.reconRunStore = runHistoryStore;

export class ReconciliationOrchestrator {
  /**
   * Execute an end-to-end reconciliation run across all 3 layers.
   */
  static async executeRun(options: RunOrchestrationOptions = {}): Promise<OrchestratedRunResult> {
    const seed = options.seed ?? 2026;
    const recordCount = options.recordCount ?? 500;
    const useAi = options.useAi ?? true;
    const aiProvider = options.aiProvider ?? (process.env.AI_PROVIDER as AiProviderType) ?? "gemini";
    const persistToDb = options.persistToDb ?? true;

    const overallStart = Date.now();
    const startTime = new Date();

    // -------------------------------------------------------------
    // STAGE 1: Dataset Generation & Deterministic First-Pass Matching
    // -------------------------------------------------------------
    const detStart = Date.now();
    const generator = new SyntheticDataGenerator({ seed, recordCount });
    const dataset = generator.generate();

    const batchResult: BatchReconciliationResult = DeterministicReconciliationEngine.reconcileBatch(
      dataset.datasetId,
      dataset.gatewayRecords,
      dataset.bankRecords,
      dataset.ledgerRecords,
      dataset.supportingEvents
    );
    const deterministicMs = Date.now() - detStart;

    // Log dataset ingestion & deterministic matching audit events
    await AuditService.log({
      runId: batchResult.runId,
      entityType: "Dataset",
      entityId: dataset.datasetId,
      action: "DATASET_INGESTED",
      actor: "RECON_ORCHESTRATOR",
      details: {
        recordCount,
        seed,
        gatewayCount: dataset.gatewayRecords.length,
        bankCount: dataset.bankRecords.length,
        ledgerCount: dataset.ledgerRecords.length,
        supportingEventsCount: dataset.supportingEvents.length,
      },
    });

    await AuditService.log({
      runId: batchResult.runId,
      entityType: "Run",
      entityId: batchResult.runId,
      action: "DETERMINISTIC_MATCHED",
      actor: "DETERMINISTIC_ENGINE",
      details: {
        matchedCount: batchResult.decisions.filter((d) => d.state === DecisionState.MATCHED).length,
        reviewCount: batchResult.decisions.filter((d) => d.state === DecisionState.REVIEW).length,
        requiresAiInvestigationCount: batchResult.decisions.filter((d) => d.requiresAiInvestigation).length,
        durationMs: deterministicMs,
      },
    });

    const initialDiscrepancies = batchResult.decisions
      .filter((d) => d.state !== DecisionState.MATCHED)
      .slice(0, 15)
      .map((d) => ({
        runId: batchResult.runId,
        entityType: "Transaction" as const,
        entityId: d.orderId,
        action: "DISCREPANCY_DETECTED" as const,
        actor: "DETERMINISTIC_ENGINE" as const,
        newState: d.state,
        details: {
          varianceMinorUnits: d.varianceMinorUnits.toString(),
          explanation: d.explanation,
          exceptionCount: d.exceptions.length,
        },
      }));
    if (initialDiscrepancies.length > 0) {
      await AuditService.logBatch(initialDiscrepancies);
    }

    // Index supporting events by referenceId for AI context injection
    const eventsByOrder = new Map<string, typeof dataset.supportingEvents>();
    for (const ev of dataset.supportingEvents) {
      const list = eventsByOrder.get(ev.referenceId) || [];
      list.push(ev);
      eventsByOrder.set(ev.referenceId, list);
    }

    // -------------------------------------------------------------
    // STAGE 2: Bounded AI Exception Investigation
    // -------------------------------------------------------------
    const aiStart = Date.now();
    let aiInvestigationsCount = 0;

    if (useAi) {
      // Find candidate decisions requiring AI investigation
      const aiCandidateItems = batchResult.decisions.filter((d) => d.requiresAiInvestigation);

      if (aiCandidateItems.length > 0) {
        // Build bounded investigation requests
        const invRequests: InvestigationRequest[] = aiCandidateItems.map((item) => ({
          orderId: item.orderId,
          initialState: item.state,
          varianceMinorUnits: item.varianceMinorUnits,
          gatewayRecord: item.gatewayRecord ? {
            ...item.gatewayRecord,
            transactionTime: new Date(item.gatewayRecord.transactionTime),
          } : undefined,
          bankRecord: item.bankRecord ? {
            ...item.bankRecord,
            valueDate: new Date(item.bankRecord.valueDate),
            bookingDate: new Date(item.bankRecord.bookingDate),
          } : undefined,
          ledgerRecord: item.ledgerRecord ? {
            ...item.ledgerRecord,
            ledgerDate: new Date(item.ledgerRecord.ledgerDate),
          } : undefined,
          supportingEvents: (eventsByOrder.get(item.orderId) || []).map((e) => ({
            ...e,
            eventDate: new Date(e.eventDate),
          })),
          candidates: item.candidates,
          provider: aiProvider,
        }));

        // Execute batch investigation through bounded AI orchestrator
        const invResults = await AiInvestigator.investigateBatch(invRequests);
        aiInvestigationsCount = invResults.length;

        // Log AI investigation audit trail
        await AuditService.log({
          runId: batchResult.runId,
          entityType: "Run",
          entityId: batchResult.runId,
          action: "AI_INVESTIGATION_DISPATCHED",
          actor: "AI_INVESTIGATOR",
          details: {
            investigationsCount: invResults.length,
            provider: aiProvider,
            durationMs: Date.now() - aiStart,
          },
        });

        const aiAuditEvents = invResults.slice(0, 15).map((aiRes) => ({
          runId: batchResult.runId,
          entityType: "AiInvestigation" as const,
          entityId: aiRes.orderId,
          action: aiRes.validationPassed ? ("VALIDATION_PASSED" as const) : ("VALIDATION_FAILED" as const),
          actor: "ANTI_HALLUCINATION_VALIDATOR" as const,
          newState: aiRes.recommendation,
          details: {
            provider: aiRes.provider,
            model: aiRes.model,
            confidence: aiRes.confidence,
            reasoningSummary: aiRes.reasoningSummary,
            citedEvidenceCount: aiRes.citedEvidence.length,
          },
        }));
        if (aiAuditEvents.length > 0) {
          await AuditService.logBatch(aiAuditEvents);
        }

        // Apply validated AI resolutions to decisions
        const resultMap = new Map(invResults.map((r) => [r.orderId, r]));

        for (const dec of batchResult.decisions) {
          const aiRes = resultMap.get(dec.orderId);
          if (aiRes && aiRes.validationPassed) {
            dec.confidence = aiRes.confidence;
            dec.explanation = `[AI Investigated: ${aiRes.provider}/${aiRes.model}] ${aiRes.reasoningSummary}`;

            if (aiRes.recommendation === DecisionState.RESOLVED) {
              dec.state = DecisionState.RESOLVED;
              dec.method = "AI_INVESTIGATED_RESOLVED";

              // Append verified evidence items cited by AI
              for (const cited of aiRes.citedEvidence) {
                dec.evidenceItems.push({
                  evidenceType: cited.evidenceType,
                  sourceRecordId: cited.sourceRecordId,
                  sourceTable: cited.sourceTable,
                  description: cited.description,
                  monetaryImpactMinorUnits: cited.monetaryImpactMinorUnits,
                });
              }

              // Update associated exceptions: mark resolved or clear
              for (const exc of dec.exceptions) {
                if (exc.exceptionType === ExceptionType.AMOUNT_MISMATCH || 
                    exc.exceptionType === ExceptionType.FEE_DISCREPANCY ||
                    exc.exceptionType === ExceptionType.TAX_DISCREPANCY) {
                  exc.recommendedAction = `RESOLVED_BY_AI: ${aiRes.reasoningSummary}`;
                }
              }
            } else if (aiRes.recommendation === DecisionState.REVIEW) {
              dec.state = DecisionState.REVIEW;
              dec.method = "AI_INVESTIGATED_REVIEW";
            } else if (aiRes.recommendation === DecisionState.CONFLICT) {
              dec.state = DecisionState.CONFLICT;
              dec.method = "AI_INVESTIGATED_CONFLICT";
            } else if (aiRes.recommendation === DecisionState.UNRESOLVED) {
              dec.state = DecisionState.UNRESOLVED;
              dec.method = "AI_INVESTIGATED_UNRESOLVED";
            }
          }
        }
      }
    }
    const aiInvestigationMs = Date.now() - aiStart;

    // -------------------------------------------------------------
    // STAGE 3: Ground-Truth Evaluation & Financial Leakage
    // -------------------------------------------------------------
    const evalStart = Date.now();
    const evaluation = ObjectiveEvaluator.evaluate({
      runId: batchResult.runId,
      decisions: batchResult.decisions,
      groundTruths: dataset.groundTruths,
      totalProcessingTimeMs: Date.now() - overallStart,
      deterministicDurationMs: deterministicMs,
      aiDurationMs: aiInvestigationMs,
      throughputPerSecond: (recordCount / ((Date.now() - overallStart) / 1000)),
    });
    const evaluationMs = Date.now() - evalStart;

    const endTime = new Date();
    const durationMs = Date.now() - overallStart;

    // Recompute final counts across decisions
    let matchedCount = 0;
    let resolvedCount = 0;
    let reviewCount = 0;
    let unresolvedCount = 0;
    let duplicateCount = 0;
    let missingCount = 0;
    let conflictCount = 0;
    let exceptionCount = 0;

    for (const dec of batchResult.decisions) {
      if (dec.state === DecisionState.MATCHED) matchedCount++;
      else if (dec.state === DecisionState.RESOLVED) resolvedCount++;
      else if (dec.state === DecisionState.REVIEW) reviewCount++;
      else if (dec.state === DecisionState.UNRESOLVED) unresolvedCount++;
      else if (dec.state === DecisionState.DUPLICATE) duplicateCount++;
      else if (dec.state === DecisionState.MISSING) missingCount++;
      else if (dec.state === DecisionState.CONFLICT) conflictCount++;

      exceptionCount += dec.exceptions.length;
    }

    const matchRatePercent = Number(((matchedCount / recordCount) * 100).toFixed(2));
    const resolutionRatePercent = Number(evaluation.resolutionRate.toFixed(2));
    const falseResolutionRatePercent = Number(evaluation.falseAutoResolutionRate.toFixed(2));
    const throughputPerSecond = Number((recordCount / (durationMs / 1000)).toFixed(1));

    const orchestratedResult: OrchestratedRunResult = {
      runId: batchResult.runId,
      datasetId: dataset.datasetId,
      seed,
      recordCount,
      status: RunStatus.COMPLETED,
      startTime,
      endTime,
      durationMs,
      stageTimings: {
        deterministicMs,
        aiInvestigationMs,
        evaluationMs,
      },
      metrics: {
        totalRecords: recordCount,
        matchedCount,
        resolvedCount,
        reviewCount,
        unresolvedCount,
        duplicateCount,
        missingCount,
        conflictCount,
        exceptionCount,
        aiInvestigationsCount,
        matchRatePercent,
        resolutionRatePercent,
        falseResolutionRatePercent,
        throughputPerSecond,
      },
      financials: {
        totalValueMinorUnits: batchResult.totalValueMinorUnits,
        reconciledValueMinorUnits: evaluation.totalValueReconciledMinorUnits,
        unresolvedValueMinorUnits: evaluation.totalUnexplainedVarianceMinorUnits,
        financialLeakageMinorUnits: evaluation.detectedLeakageMinorUnits,
        preventedLeakageMinorUnits: evaluation.preventedLeakageMinorUnits,
        recoverableMinorUnits: evaluation.recoverableMinorUnits,
        formattedTotal: Money.formatPaise(batchResult.totalValueMinorUnits),
        formattedReconciled: Money.formatPaise(evaluation.totalValueReconciledMinorUnits),
        formattedUnresolved: Money.formatPaise(evaluation.totalUnexplainedVarianceMinorUnits),
        formattedLeakage: Money.formatPaise(evaluation.detectedLeakageMinorUnits),
        formattedPrevented: Money.formatPaise(evaluation.preventedLeakageMinorUnits),
        formattedRecoverable: Money.formatPaise(evaluation.recoverableMinorUnits),
      },
      decisions: batchResult.decisions,
      evaluation,
    };

    // Save to in-memory history cache
    runHistoryStore.saveRun(orchestratedResult);

    // Log run completed audit event
    await AuditService.log({
      runId: batchResult.runId,
      entityType: "Run",
      entityId: batchResult.runId,
      action: "RUN_COMPLETED",
      actor: "RECON_ORCHESTRATOR",
      newState: "COMPLETED",
      details: {
        recordCount,
        durationMs,
        matchedCount,
        resolvedCount,
        unresolvedCount,
        matchRatePercent,
        f1Score: evaluation.f1Score,
        financialLeakage: Money.formatPaise(evaluation.detectedLeakageMinorUnits),
        preventedLeakage: Money.formatPaise(evaluation.preventedLeakageMinorUnits),
      },
    });

    // -------------------------------------------------------------
    // STAGE 4: Persistence to PostgreSQL via Prisma
    // -------------------------------------------------------------
    if (persistToDb) {
      try {
        await this.persistRunToDatabase(orchestratedResult, dataset);
      } catch (err) {
        console.warn("[Recon.ai Orchestrator] Database persistence failed or skipped. In-memory store active:", err);
      }
    }

    return orchestratedResult;
  }

  /**
   * Persist run, decisions, exceptions, evidence, and evaluation to PostgreSQL.
   */
  private static async persistRunToDatabase(
    result: OrchestratedRunResult,
    dataset: GeneratedDataset
  ): Promise<void> {
    // 1. Create or upsert SourceDataset
    await prisma.sourceDataset.upsert({
      where: { id: dataset.datasetId },
      update: { recordCount: result.recordCount },
      create: {
        id: dataset.datasetId,
        name: dataset.name,
        seed: dataset.seed,
        recordCount: result.recordCount,
        description: `Synthetic financial batch of ${result.recordCount} records (seed ${result.seed})`,
      },
    });

    // 2. Create ReconciliationRun
    const runRecord = await prisma.reconciliationRun.create({
      data: {
        id: result.runId,
        datasetId: dataset.datasetId,
        status: RunStatus.COMPLETED,
        startTime: result.startTime,
        endTime: result.endTime,
        durationMs: result.durationMs,
        totalRecordsProcessed: result.recordCount,
        matchedCount: result.metrics.matchedCount,
        resolvedCount: result.metrics.resolvedCount,
        reviewCount: result.metrics.reviewCount,
        unresolvedCount: result.metrics.unresolvedCount,
        duplicateCount: result.metrics.duplicateCount,
        missingCount: result.metrics.missingCount,
        conflictCount: result.metrics.conflictCount,
        exceptionCount: result.metrics.exceptionCount,
        totalValueMinorUnits: result.financials.totalValueMinorUnits,
        reconciledValueMinorUnits: result.financials.reconciledValueMinorUnits,
        unresolvedValueMinorUnits: result.financials.unresolvedValueMinorUnits,
        financialLeakageMinorUnits: result.financials.financialLeakageMinorUnits,
        throughputPerSecond: result.metrics.throughputPerSecond,
        aiInvestigationCount: result.metrics.aiInvestigationsCount,
        aiDurationMs: result.stageTimings.aiInvestigationMs,
      },
    });

    // 3. Batch create ReconciliationDecisions & Exceptions
    for (const dec of result.decisions) {
      const decisionRecord = await prisma.reconciliationDecision.create({
        data: {
          runId: runRecord.id,
          orderId: dec.orderId,
          state: dec.state,
          method: dec.method,
          confidence: dec.confidence,
          varianceMinorUnits: dec.varianceMinorUnits,
          explanation: dec.explanation,
        },
      });

      // Insert exceptions
      for (const exc of dec.exceptions) {
        await prisma.exceptionRecord.create({
          data: {
            runId: runRecord.id,
            decisionId: decisionRecord.id,
            orderId: exc.orderId,
            exceptionType: exc.exceptionType,
            severity: exc.severity,
            monetaryImpactMinorUnits: exc.monetaryImpactMinorUnits,
            title: exc.title,
            description: exc.description,
            recommendedAction: exc.recommendedAction,
            resolved: dec.state === DecisionState.RESOLVED,
          },
        });
      }

      // Insert evidence items
      for (const ev of dec.evidenceItems) {
        await prisma.evidenceItem.create({
          data: {
            decisionId: decisionRecord.id,
            evidenceType: ev.evidenceType,
            sourceRecordId: ev.sourceRecordId,
            sourceTable: ev.sourceTable,
            description: ev.description,
            monetaryImpactMinorUnits: ev.monetaryImpactMinorUnits,
          },
        });
      }
    }

    // 4. Create EvaluationResult
    await prisma.evaluationResult.create({
      data: {
        runId: runRecord.id,
        matchRate: result.evaluation.matchRate,
        precision: result.evaluation.precision,
        recall: result.evaluation.recall,
        f1Score: result.evaluation.f1Score,
        resolutionRate: result.evaluation.resolutionRate,
        falseAutoResolutionRate: result.evaluation.falseAutoResolutionRate,
        exceptionAccuracy: result.evaluation.exceptionAccuracy,
        reviewRate: result.evaluation.reviewRate,
        unresolvedRate: result.evaluation.unresolvedRate,
        totalGroundTruthCases: result.evaluation.totalGroundTruthCases,
        correctDecisions: result.evaluation.correctDecisions,
        falsePositives: result.evaluation.falsePositives,
        falseNegatives: result.evaluation.falseNegatives,
        adversarialRobustnessRate: result.evaluation.adversarialRobustnessRate,
        totalValueReconciledMinorUnits: result.evaluation.totalValueReconciledMinorUnits,
        totalUnexplainedVarianceMinorUnits: result.evaluation.totalUnexplainedVarianceMinorUnits,
        detectedLeakageMinorUnits: result.evaluation.detectedLeakageMinorUnits,
        preventedLeakageMinorUnits: result.evaluation.preventedLeakageMinorUnits,
        scenarioBreakdown: result.evaluation.scenarioBreakdown as any,
        leakageBreakdown: result.evaluation.leakageBreakdown as any,
        throughputPerSecond: result.evaluation.throughputPerSecond,
        totalProcessingTimeMs: result.evaluation.totalProcessingTimeMs,
        deterministicDurationMs: result.evaluation.deterministicDurationMs,
        aiDurationMs: result.evaluation.aiDurationMs,
      },
    });

    // 5. Batch persist audit trail events for this run
    const runAuditEvents = auditMemoryStore.getAll(result.runId);
    if (runAuditEvents.length > 0) {
      await prisma.auditEvent.createMany({
        data: runAuditEvents.map((e) => ({
          runId: runRecord.id,
          entityType: e.entityType,
          entityId: e.entityId,
          action: e.action,
          actor: e.actor,
          previousState: e.previousState,
          newState: e.newState,
          details: e.details as any,
          timestamp: e.timestamp || new Date(),
        })),
        skipDuplicates: true,
      });
    }
  }
}
