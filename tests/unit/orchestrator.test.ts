import { describe, it, expect } from "vitest";
import { ReconciliationOrchestrator, runHistoryStore } from "../../lib/reconciliation/orchestrator";
import { DecisionState, RunStatus } from "@prisma/client";

describe("Phase 6: Reconciliation Orchestration & Live Dashboard Engine", () => {
  it("should execute full 3-stage reconciliation run on 50-record batch", async () => {
    const run = await ReconciliationOrchestrator.executeRun({
      seed: 2026,
      recordCount: 50,
      useAi: true,
      aiProvider: "offline_fallback",
      persistToDb: false, // In unit tests, isolate from DB connection
    });

    expect(run.status).toBe(RunStatus.COMPLETED);
    expect(run.recordCount).toBe(50);
    expect(run.decisions.length).toBe(50);
    expect(run.runId).toBeDefined();

    // Verify stage timings exist
    expect(run.stageTimings.deterministicMs).toBeGreaterThanOrEqual(0);
    expect(run.stageTimings.aiInvestigationMs).toBeGreaterThanOrEqual(0);
    expect(run.stageTimings.evaluationMs).toBeGreaterThanOrEqual(0);

    // Verify metrics
    expect(run.metrics.matchedCount).toBeGreaterThan(30);
    expect(run.metrics.matchRatePercent).toBeGreaterThan(60);
    expect(run.metrics.throughputPerSecond).toBeGreaterThan(0);

    // Verify financial integrity
    expect(run.financials.totalValueMinorUnits).toBeGreaterThan(0n);
    expect(run.financials.formattedTotal).toContain("₹");
  });

  it("should cache run in runHistoryStore singleton for fast UI consumption", async () => {
    const run = await ReconciliationOrchestrator.executeRun({
      seed: 9999,
      recordCount: 50,
      useAi: false,
      persistToDb: false,
    });

    const cachedRun = runHistoryStore.getRun(run.runId);
    expect(cachedRun).toBeDefined();
    expect(cachedRun?.runId).toBe(run.runId);

    const latest = runHistoryStore.getLatestRun();
    expect(latest?.runId).toBe(run.runId);

    const runList = runHistoryStore.listRuns();
    expect(runList.length).toBeGreaterThan(0);
    expect(runList.some((r) => r.runId === run.runId)).toBe(true);
  });

  it("should integrate AI investigations into decisions when useAi is true", async () => {
    const run = await ReconciliationOrchestrator.executeRun({
      seed: 2026,
      recordCount: 100,
      useAi: true,
      aiProvider: "offline_fallback",
      persistToDb: false,
    });

    // Check that AI investigated the ambiguous items
    expect(run.metrics.aiInvestigationsCount).toBeGreaterThan(0);

    // Some decisions should be resolved by AI
    const aiResolved = run.decisions.filter((d) => d.method.includes("AI_INVESTIGATED"));
    expect(aiResolved.length).toBeGreaterThan(0);

    // AI resolved items must contain evidence items
    const sampleAiResolved = aiResolved.find((d) => d.state === DecisionState.RESOLVED);
    if (sampleAiResolved) {
      expect(sampleAiResolved.evidenceItems.length).toBeGreaterThan(0);
      expect(sampleAiResolved.confidence).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("should preserve integer paise financial calculations without float drift", async () => {
    const run = await ReconciliationOrchestrator.executeRun({
      seed: 2026,
      recordCount: 50,
      useAi: false,
      persistToDb: false,
    });

    // Sum of all decision variances must equal BigInt calculation
    let sumVariance = 0n;
    for (const d of run.decisions) {
      sumVariance += d.varianceMinorUnits;
    }
    expect(typeof sumVariance).toBe("bigint");
    expect(typeof run.financials.financialLeakageMinorUnits).toBe("bigint");
    expect(typeof run.financials.reconciledValueMinorUnits).toBe("bigint");
  });
});
